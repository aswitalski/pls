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

  // Filter out ignore and discard tasks early
  const validTasks = tasks.filter(
    (task) => task.type !== TaskType.Ignore && task.type !== TaskType.Discard
  );

  // Check if no valid tasks remain after filtering
  if (validTasks.length === 0) {
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

  const operation = getOperationName(validTasks);

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
    const scheduleDefinition = createSchedule({ message, tasks: validTasks });
    workflowHandlers.addToQueue(scheduleDefinition);
  } else {
    // No DEFINE tasks - Schedule auto-completes and adds Confirm to queue
    // When Schedule activates, Command moves to timeline
    // When Schedule completes, it moves to pending
    // When Confirm activates, Schedule stays pending (visible for context)
    const scheduleDefinition = createSchedule({
      message,
      tasks: validTasks,
      onSelectionConfirmed: () => {
        // Schedule completed - add Confirm to queue
        const confirmDefinition = createConfirm({
          message: getConfirmationMessage(),
          onConfirmed: () => {
            // User confirmed - complete both Confirm and Schedule, then route
            lifecycleHandlers.completeActiveAndPending();
            executeTasksAfterConfirm(validTasks, context);
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
 * Task types that should appear in the upcoming display
 */
const UPCOMING_TASK_TYPES = [TaskType.Execute, TaskType.Answer, TaskType.Group];

/**
 * Collect action names for tasks that appear in upcoming display.
 * Groups are included with their group name (not individual subtask names).
 */
function collectUpcomingNames(tasks: ScheduledTask[]): string[] {
  return tasks
    .filter((t) => UPCOMING_TASK_TYPES.includes(t.type))
    .map((t) => t.action);
}

/**
 * Route tasks after config is complete (or when no config is needed)
 * Processes task list, routing each task type to its handler.
 * Top-level groups are preserved: their subtasks are routed with the group name.
 * Config tasks are grouped together; Execute/Answer are routed individually.
 */
function routeTasksAfterConfig(
  tasks: ScheduledTask[],
  context: RoutingContext
): void {
  if (tasks.length === 0) return;

  // Collect all upcoming names for display (Execute, Answer, and Group tasks)
  const allUpcomingNames = collectUpcomingNames(tasks);
  let upcomingIndex = 0;

  // Task types that should be grouped together (one component for all tasks)
  const groupedTypes = [TaskType.Config, TaskType.Introspect];

  // Route grouped task types together (collect from all tasks including subtasks)
  for (const groupedType of groupedTypes) {
    const typeTasks: Task[] = [];
    for (const task of tasks) {
      if (task.type === groupedType) {
        typeTasks.push(task);
      } else if (task.type === TaskType.Group && task.subtasks) {
        typeTasks.push(...task.subtasks.filter((t) => t.type === groupedType));
      }
    }
    if (typeTasks.length > 0) {
      routeTasksByType(groupedType, typeTasks, context, []);
    }
  }

  // Process Execute, Answer, and Group tasks individually (with upcoming support)
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskType = task.type;

    // Skip grouped task types (already routed above)
    if (groupedTypes.includes(taskType)) continue;

    if (taskType === TaskType.Group && task.subtasks) {
      // Route group's subtasks - Execute tasks get group label, others routed normally
      const upcoming = allUpcomingNames.slice(upcomingIndex + 1);
      upcomingIndex++;

      // Separate subtasks by type
      const executeSubtasks = task.subtasks.filter(
        (t) => t.type === TaskType.Execute
      );
      const answerSubtasks = task.subtasks.filter(
        (t) => t.type === TaskType.Answer
      );

      // Route Execute subtasks with group name as label
      if (executeSubtasks.length > 0) {
        routeExecuteTasks(executeSubtasks, context, upcoming, task.action);
      }

      // Route Answer subtasks individually
      if (answerSubtasks.length > 0) {
        routeAnswerTasks(answerSubtasks, context, upcoming);
      }
    } else if (taskType === TaskType.Execute) {
      // Calculate upcoming for this Execute task
      const upcoming = allUpcomingNames.slice(upcomingIndex + 1);
      upcomingIndex++;
      routeExecuteTasks([task], context, upcoming);
    } else if (taskType === TaskType.Answer) {
      // Calculate upcoming for this Answer task
      const upcoming = allUpcomingNames.slice(upcomingIndex + 1);
      upcomingIndex++;
      routeTasksByType(taskType, [task], context, upcoming);
    } else {
      // For other types (Report, etc.), route without upcoming
      routeTasksByType(taskType, [task], context, []);
    }
  }
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
 * Route Config tasks - extracts keys, caches labels, creates Config component
 */
function routeConfigTasks(
  tasks: Task[],
  context: RoutingContext,
  _upcoming: string[]
): void {
  const configKeys = tasks
    .map((task) => task.params?.key as string | undefined)
    .filter((key): key is string => key !== undefined);

  // Extract and cache labels from task descriptions
  // Only cache labels for dynamically discovered keys (not in schema)
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
      onFinished: (config: Record<string, string>) => {
        // Save config - Config component will handle completion and feedback
        try {
          // Convert flat dotted keys to nested structure grouped by section
          const configBySection = unflattenConfig(config);

          // Save each section
          for (const [section, sectionConfig] of Object.entries(
            configBySection
          )) {
            saveConfig(section, sectionConfig);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to save configuration';
          throw new Error(errorMessage);
        }
      },
      onAborted: (operation: string) => {
        context.requestHandlers.onAborted(operation);
      },
    })
  );
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
