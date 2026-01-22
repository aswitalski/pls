import { BaseState, ComponentDefinition } from '../types/components.js';
import {
  LifecycleHandlers,
  RequestHandlers,
  WorkflowHandlers,
} from '../types/handlers.js';
import { asScheduledTasks } from '../types/guards.js';
import { FeedbackType, ScheduledTask, Task, TaskType } from '../types/types.js';

import { saveConfig } from '../configuration/io.js';
import { getConfigSchema } from '../configuration/schema.js';
import { createConfigStepsFromSchema } from '../configuration/steps.js';
import { unflattenConfig } from '../configuration/transformation.js';
import { LLMService } from './anthropic.js';
import { saveConfigLabels } from '../configuration/labels.js';
import {
  createAnswer,
  createConfig,
  createConfirm,
  createExecute,
  createFeedback,
  createIntrospect,
  createSchedule,
  createValidate,
} from './components.js';
import {
  getCancellationMessage,
  getConfirmationMessage,
  getUnknownRequestMessage,
} from './messages.js';
import { validateExecuteTasks } from './validator.js';

/**
 * Task Routing Architecture
 *
 * Flow: Command -> SCHEDULE -> routeTasksWithConfirm() -> extractTaskGroups()
 *       -> routeAllGroups() -> routeGroupTasks() -> Workflow queue
 *
 * Key Concepts:
 * - TaskGroup: Logical grouping for sequential processing
 * - Routing Category: Determines which tasks can be grouped together
 * - Two-Phase Routing: Config/Introspect first, then Execute/Answer
 *
 * Isolation Principle: Explicit Group tasks always become their own
 * TaskGroup, preventing cross-contamination between user-defined groups.
 */

/**
 * Flatten inner task structure completely - removes all nested groups.
 * Used internally to flatten subtasks within a top-level group.
 */
function flattenInnerTasks(tasks: ScheduledTask[]): Task[] {
  const result: Task[] = [];

  for (const task of tasks) {
    if (
      task.type === TaskType.Group &&
      task.subtasks &&
      task.subtasks.length > 0
    ) {
      // Recursively flatten inner group
      result.push(...flattenInnerTasks(task.subtasks));
    } else if (task.type !== TaskType.Group) {
      // Leaf task - add as-is
      const leafTask: Task = {
        action: task.action,
        type: task.type,
      };
      if (task.params) leafTask.params = task.params;
      if (task.config) leafTask.config = task.config;
      result.push(leafTask);
    }
    // Skip empty groups
  }

  return result;
}

/**
 * Flatten hierarchical task structure, preserving top-level groups.
 * Top-level groups are kept with their subtasks flattened.
 * Inner nested groups are removed and their subtasks extracted recursively.
 */
export function flattenTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  const result: ScheduledTask[] = [];

  for (const task of tasks) {
    if (
      task.type === TaskType.Group &&
      task.subtasks &&
      task.subtasks.length > 0
    ) {
      // Preserve top-level group but flatten its subtasks
      const flattenedSubtasks = flattenInnerTasks(task.subtasks);
      const groupTask: ScheduledTask = {
        action: task.action,
        type: task.type,
        subtasks: flattenedSubtasks,
      };
      result.push(groupTask);
    } else if (task.type !== TaskType.Group) {
      // Non-group task - add as-is
      const leafTask: ScheduledTask = {
        action: task.action,
        type: task.type,
      };
      if (task.params) leafTask.params = task.params;
      if (task.config) leafTask.config = task.config;
      result.push(leafTask);
    }
    // Skip empty groups (group with no subtasks)
  }

  return result;
}

/**
 * Context for routing operations - bundles dependencies needed by handlers
 */
interface RoutingContext {
  service: LLMService;
  userRequest: string;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
  requestHandlers: RequestHandlers<BaseState>;
}

/**
 * Handler function type for routing tasks of a specific type
 */
type TaskRouteHandler = (
  tasks: Task[],
  context: RoutingContext,
  upcoming: string[]
) => void;

/**
 * Determine the operation name based on task types
 */
export function getOperationName(tasks: Task[]): string {
  const allIntrospect = tasks.every(
    (task) => task.type === TaskType.Introspect
  );
  const allAnswer = tasks.every((task) => task.type === TaskType.Answer);

  if (allIntrospect) return 'introspection';
  if (allAnswer) return 'answer';
  return 'execution';
}

/**
 * Route tasks to appropriate components with Confirm flow
 * Handles the complete flow: Plan → Confirm → Execute/Answer/Introspect
 */
export function routeTasksWithConfirm<TState extends BaseState = BaseState>(
  tasks: Task[],
  message: string,
  service: LLMService,
  userRequest: string,
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>,
  workflowHandlers: WorkflowHandlers<ComponentDefinition>,
  requestHandlers: RequestHandlers<TState>,
  hasDefineTask: boolean = false
): void {
  if (tasks.length === 0) return;

  // Check executable tasks (ignore/discard are shown but not executed)
  const executableTasks = tasks.filter(
    (task) => task.type !== TaskType.Ignore && task.type !== TaskType.Discard
  );

  // Check if no executable tasks remain after filtering
  if (executableTasks.length === 0) {
    // Use action from first ignore task if available, otherwise generic message
    const ignoreTask = tasks.find((task) => task.type === TaskType.Ignore);
    const message = ignoreTask?.action
      ? `${ignoreTask.action}.`
      : getUnknownRequestMessage();
    workflowHandlers.addToQueue(
      createFeedback({ type: FeedbackType.Warning, message })
    );
    return;
  }

  const operation = getOperationName(executableTasks);

  // Create routing context for downstream functions
  const context: RoutingContext = {
    service,
    userRequest,
    workflowHandlers,
    requestHandlers: requestHandlers as RequestHandlers<BaseState>,
  };

  if (hasDefineTask) {
    // Has DEFINE tasks - add Schedule to queue for user selection
    // Refinement flow will call this function again with refined tasks
    // Show all tasks (including ignore) for display
    const scheduleDefinition = createSchedule({ message, tasks });
    workflowHandlers.addToQueue(scheduleDefinition);
  } else {
    // No DEFINE tasks - Schedule auto-completes and adds Confirm to queue
    // When Schedule activates, Command moves to timeline
    // When Schedule completes, it moves to pending
    // When Confirm activates, Schedule stays pending (visible for context)
    // Show all tasks (including ignore) for display
    const scheduleDefinition = createSchedule({
      message,
      tasks,
      onSelectionConfirmed: () => {
        // Schedule completed - add Confirm to queue
        const confirmDefinition = createConfirm({
          message: getConfirmationMessage(),
          onConfirmed: () => {
            // User confirmed - complete both Confirm and Schedule, then route
            lifecycleHandlers.completeActiveAndPending();
            // Only execute non-ignore/non-discard tasks
            executeTasksAfterConfirm(executableTasks, context);
          },
          onCancelled: () => {
            // User cancelled - complete both Confirm and Schedule, then show cancellation
            lifecycleHandlers.completeActiveAndPending();
            const message = getCancellationMessage(operation);
            workflowHandlers.addToQueue(
              createFeedback({ type: FeedbackType.Aborted, message })
            );
          },
        });
        workflowHandlers.addToQueue(confirmDefinition);
      },
    });

    workflowHandlers.addToQueue(scheduleDefinition);
  }
}

/**
 * Validate task structure after flattening.
 * Currently no-op since flattening removes Groups and mixed types are allowed.
 */
function validateTaskTypes(_tasks: Task[]): void {
  // After flattening, Groups are removed and mixed leaf types are allowed.
  // The router handles different task types by routing each to its handler.
}

/**
 * Execute tasks after confirmation (internal helper)
 * Flattens hierarchical structure, validates task types, and routes appropriately
 */
function executeTasksAfterConfirm(
  tasks: Task[],
  context: RoutingContext
): void {
  const { service, userRequest, workflowHandlers, requestHandlers } = context;

  // Flatten hierarchical structure into flat list of leaf tasks
  const scheduledTasks = asScheduledTasks(tasks);
  const flatTasks = flattenTasks(scheduledTasks);

  // Validate that all tasks have uniform type
  try {
    validateTaskTypes(flatTasks);
  } catch (error) {
    requestHandlers.onError(
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  // Collect all Execute tasks for validation (including those inside groups)
  const executeTasks: Task[] = [];
  for (const task of flatTasks) {
    if (task.type === TaskType.Execute) {
      executeTasks.push(task);
    } else if (task.type === TaskType.Group && task.subtasks) {
      executeTasks.push(
        ...task.subtasks.filter((t) => t.type === TaskType.Execute)
      );
    }
  }

  // Validate Execute tasks to collect missing config upfront
  if (executeTasks.length > 0) {
    try {
      const validation = validateExecuteTasks(executeTasks);

      if (validation.validationErrors.length > 0) {
        // Show error feedback for invalid skills
        const errorMessages = validation.validationErrors.map((error) => {
          const issuesList = error.issues
            .map((issue) => `  - ${issue}`)
            .join('\n');
          return `Invalid skill definition "${error.skill}":\n\n${issuesList}`;
        });

        workflowHandlers.addToQueue(
          createFeedback({
            type: FeedbackType.Failed,
            message: errorMessages.join('\n\n'),
          })
        );
        return;
      } else if (validation.missingConfig.length > 0) {
        // Missing config detected - create Validate component for all missing config
        workflowHandlers.addToQueue(
          createValidate({
            missingConfig: validation.missingConfig,
            userRequest,
            service,
            onError: (error: string) => {
              requestHandlers.onError(error);
            },
            onValidationComplete: () => {
              // After config is complete, resume task routing
              routeTasksAfterConfig(flatTasks, context);
            },
            onAborted: (operation: string) => {
              requestHandlers.onAborted(operation);
            },
          })
        );
        return;
      }
    } catch (error) {
      requestHandlers.onError(
        error instanceof Error ? error.message : String(error)
      );
      return;
    }
  }

  // No missing config - proceed with normal routing
  routeTasksAfterConfig(flatTasks, context);
}

/**
 * Collect action names for upcoming display.
 * All task types are shown so users see the full queue of work ahead.
 */
function collectUpcomingNames(tasks: ScheduledTask[]): string[] {
  return tasks.map((t) => t.action);
}

/**
 * Represents a logical task group for sequential processing
 */
export interface TaskGroup {
  name: string;
  tasks: ScheduledTask[];
}

/**
 * Get the routing category for a task type.
 * Tasks in the same category can be grouped together.
 * Config and Introspect are special categories that should be isolated.
 */
export function getRoutingCategory(task: ScheduledTask): string {
  // Groups with subtasks get their own category (based on subtask types)
  if (
    task.type === TaskType.Group &&
    task.subtasks &&
    task.subtasks.length > 0
  ) {
    // Check what types of subtasks this group has
    const hasConfig = task.subtasks.some((t) => t.type === TaskType.Config);
    const hasIntrospect = task.subtasks.some(
      (t) => t.type === TaskType.Introspect
    );
    const hasExecute = task.subtasks.some((t) => t.type === TaskType.Execute);
    const hasAnswer = task.subtasks.some((t) => t.type === TaskType.Answer);

    // Mixed types get unique category to ensure isolation
    const typeCount =
      (hasConfig ? 1 : 0) +
      (hasIntrospect ? 1 : 0) +
      (hasExecute ? 1 : 0) +
      (hasAnswer ? 1 : 0);
    if (typeCount > 1) {
      return `mixed:${task.action}`;
    }

    // Single type groups use that type's category
    if (hasConfig) return 'config';
    if (hasIntrospect) return 'introspect';
    if (hasExecute) return 'execute';
    if (hasAnswer) return 'answer';
    return 'group';
  }

  // Standalone tasks use their type as category
  switch (task.type) {
    case TaskType.Config:
      return 'config';
    case TaskType.Introspect:
      return 'introspect';
    case TaskType.Execute:
      return 'execute';
    case TaskType.Answer:
      return 'answer';
    default:
      return task.type;
  }
}

/**
 * Extract logical task groups from a flat task list.
 * Each explicit Group (TaskType.Group) becomes its own TaskGroup for isolation.
 * Consecutive standalone tasks of the same routing category are grouped together.
 */
export function extractTaskGroups(tasks: ScheduledTask[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  let currentGroup: TaskGroup | null = null;
  let currentCategory: string | null = null;

  for (const task of tasks) {
    // Skip empty groups
    if (
      task.type === TaskType.Group &&
      (!task.subtasks || task.subtasks.length === 0)
    ) {
      continue;
    }

    // Explicit Groups always become their own TaskGroup for isolation
    if (task.type === TaskType.Group) {
      // Save current group if exists
      if (currentGroup !== null) {
        groups.push(currentGroup);
        currentGroup = null;
        currentCategory = null;
      }
      // Create standalone TaskGroup for this Group
      groups.push({
        name: task.action,
        tasks: [task],
      });
      continue;
    }

    const category = getRoutingCategory(task);

    // Start new group when category changes (or first task)
    if (currentGroup === null || category !== currentCategory) {
      if (currentGroup !== null) {
        groups.push(currentGroup);
      }
      currentGroup = {
        name: task.action,
        tasks: [task],
      };
      currentCategory = category;
    } else {
      // Same category - add to current group
      currentGroup.tasks.push(task);
    }
  }

  // Don't forget the last group
  if (currentGroup !== null) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Route all groups in order, calculating correct upcoming for each.
 * Groups are processed sequentially by the Workflow's queue mechanism.
 */
function routeAllGroups(groups: TaskGroup[], context: RoutingContext): void {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    // Calculate upcoming from LATER groups (not current group)
    const laterGroups = groups.slice(i + 1);
    const laterUpcoming = laterGroups.flatMap((g) =>
      collectUpcomingNames(g.tasks)
    );

    // Route this group's tasks with upcoming from later groups
    routeGroupTasks(group, context, laterUpcoming);
  }
}

/**
 * Route all tasks within a single group in the order received from LLM.
 * Standalone tasks become individual components.
 * Group subtasks are batched by type (Execute subtasks together, etc.).
 */
function routeGroupTasks(
  group: TaskGroup,
  context: RoutingContext,
  groupUpcoming: string[]
): void {
  const tasks = group.tasks;
  const withinGroupUpcoming = collectUpcomingNames(tasks);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskType = task.type;

    // Calculate upcoming: remaining tasks in this group + tasks from later groups
    const remainingInGroup = withinGroupUpcoming.slice(i + 1);
    const taskUpcoming = [...remainingInGroup, ...groupUpcoming];

    // Handle Group tasks with subtasks - batch subtasks by type
    if (taskType === TaskType.Group && task.subtasks) {
      // Batch Execute subtasks together (sent to LLM as single request)
      const executeSubtasks = task.subtasks.filter(
        (t) => t.type === TaskType.Execute
      );
      if (executeSubtasks.length > 0) {
        routeExecuteTasks(executeSubtasks, context, taskUpcoming, task.action);
      }

      // Route Answer subtasks (each becomes its own component)
      const answerSubtasks = task.subtasks.filter(
        (t) => t.type === TaskType.Answer
      );
      if (answerSubtasks.length > 0) {
        routeAnswerTasks(answerSubtasks, context, taskUpcoming);
      }

      // Route other subtask types individually
      for (const subtask of task.subtasks) {
        if (
          subtask.type !== TaskType.Execute &&
          subtask.type !== TaskType.Answer
        ) {
          routeTasksByType(subtask.type, [subtask], context, taskUpcoming);
        }
      }
    } else if (taskType === TaskType.Execute) {
      routeExecuteTasks([task], context, taskUpcoming);
    } else if (taskType === TaskType.Answer) {
      routeAnswerTasks([task], context, taskUpcoming);
    } else {
      routeTasksByType(taskType, [task], context, taskUpcoming);
    }
  }
}

/**
 * Route tasks after config is complete (or when no config is needed)
 * Processes task groups in order - groups with different task types are
 * kept separate to ensure proper lifecycle handling.
 */
function routeTasksAfterConfig(
  tasks: ScheduledTask[],
  context: RoutingContext
): void {
  if (tasks.length === 0) return;

  // Extract logical task groups
  const groups = extractTaskGroups(tasks);
  if (groups.length === 0) return;

  // Route all groups in order
  routeAllGroups(groups, context);
}

/**
 * Route Answer tasks - creates separate Answer component for each question
 */
function routeAnswerTasks(
  tasks: Task[],
  context: RoutingContext,
  upcoming: string[]
): void {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    // Calculate upcoming: remaining answer tasks + original upcoming
    const remainingAnswers = tasks.slice(i + 1).map((t) => t.action);
    const taskUpcoming = [...remainingAnswers, ...upcoming];
    context.workflowHandlers.addToQueue(
      createAnswer({
        question: task.action,
        service: context.service,
        upcoming: taskUpcoming,
      })
    );
  }
}

/**
 * Route Introspect tasks - creates single Introspect component for all tasks
 */
function routeIntrospectTasks(
  tasks: Task[],
  context: RoutingContext,
  _upcoming: string[]
): void {
  context.workflowHandlers.addToQueue(
    createIntrospect({ tasks, service: context.service })
  );
}

/**
 * Route Config tasks - extracts keys or uses query, creates Config component
 */
function routeConfigTasks(
  tasks: Task[],
  context: RoutingContext,
  _upcoming: string[]
): void {
  // Extract specific keys from task params
  const configKeys = tasks
    .map((task) => task.params?.key as string | undefined)
    .filter((key): key is string => key !== undefined);

  // Handler for saving config values
  const onFinished = (config: Record<string, string>) => {
    try {
      const configBySection = unflattenConfig(config);
      for (const [section, sectionConfig] of Object.entries(configBySection)) {
        saveConfig(section, sectionConfig);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save configuration';
      throw new Error(errorMessage);
    }
  };

  const onAborted = (operation: string) => {
    context.requestHandlers.onAborted(operation);
  };

  if (configKeys.length > 0) {
    // Has specific keys - create steps directly
    const schema = getConfigSchema();
    const labels: Record<string, string> = {};
    for (const task of tasks) {
      const key = task.params?.key as string | undefined;
      if (key && task.action && !(key in schema)) {
        labels[key] = task.action;
      }
    }
    if (Object.keys(labels).length > 0) {
      saveConfigLabels(labels);
    }

    context.workflowHandlers.addToQueue(
      createConfig({
        steps: createConfigStepsFromSchema(configKeys),
        onFinished,
        onAborted,
      })
    );
  } else {
    // No keys - use query (Config will resolve via CONFIGURE tool)
    const query = tasks[0]?.params?.query as string | undefined;
    if (query) {
      context.workflowHandlers.addToQueue(
        createConfig({
          query,
          service: context.service,
          onFinished,
          onAborted,
        })
      );
    }
  }
}

/**
 * Route Execute tasks - creates Execute component (validation already done)
 */
function routeExecuteTasks(
  tasks: Task[],
  context: RoutingContext,
  upcoming: string[],
  label?: string
): void {
  context.workflowHandlers.addToQueue(
    createExecute({ tasks, service: context.service, upcoming, label })
  );
}

/**
 * Registry mapping task types to their route handlers
 */
const taskRouteHandlers: Partial<Record<TaskType, TaskRouteHandler>> = {
  [TaskType.Answer]: routeAnswerTasks,
  [TaskType.Introspect]: routeIntrospectTasks,
  [TaskType.Config]: routeConfigTasks,
  [TaskType.Execute]: routeExecuteTasks,
};

/**
 * Route tasks by type to appropriate components
 * Uses registry pattern for extensibility
 */
function routeTasksByType(
  taskType: TaskType,
  tasks: Task[],
  context: RoutingContext,
  upcoming: string[]
): void {
  const handler = taskRouteHandlers[taskType];
  if (handler) {
    handler(tasks, context, upcoming);
  }
}
