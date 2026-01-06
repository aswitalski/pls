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
  createMessage,
  createSchedule,
  createValidate,
} from './components.js';
import {
  getCancellationMessage,
  getConfirmationMessage,
  getMixedTaskTypesError,
  getUnknownRequestMessage,
} from './messages.js';
import { validateExecuteTasks } from './validator.js';

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
    const msg = createMessage({ text: getUnknownRequestMessage() });
    workflowHandlers.addToQueue(msg);
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
 * Validate task types - allows mixed types at top level with Groups,
 * but each Group must have uniform subtask types
 */
function validateTaskTypes(tasks: Task[]): void {
  if (tasks.length === 0) return;

  // Convert to ScheduledTask to access subtasks property
  const scheduledTasks = asScheduledTasks(tasks);

  // Check each Group task's subtasks for uniform types
  for (const task of scheduledTasks) {
    if (
      task.type === TaskType.Group &&
      task.subtasks &&
      task.subtasks.length > 0
    ) {
      const subtaskTypes = new Set(task.subtasks.map((t) => t.type));
      if (subtaskTypes.size > 1) {
        throw new Error(getMixedTaskTypesError(Array.from(subtaskTypes)));
      }
      // Recursively validate nested groups
      validateTaskTypes(task.subtasks as Task[]);
    }
  }
}

/**
 * Execute tasks after confirmation (internal helper)
 * Validates task types and routes each type appropriately
 * Supports mixed types at top level with Groups
 */
function executeTasksAfterConfirm(
  tasks: Task[],
  context: RoutingContext
): void {
  const { service, userRequest, workflowHandlers, requestHandlers } = context;

  // Validate task types (Groups must have uniform subtasks)
  try {
    validateTaskTypes(tasks);
  } catch (error) {
    requestHandlers.onError(
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  const scheduledTasks = asScheduledTasks(tasks);

  // Collect ALL Execute tasks (standalone and from groups) for upfront validation
  const allExecuteTasks: Task[] = [];
  for (const task of scheduledTasks) {
    if (task.type === TaskType.Execute) {
      allExecuteTasks.push(task as Task);
    } else if (task.type === TaskType.Group && task.subtasks) {
      const subtasks = task.subtasks as Task[];
      if (subtasks.length > 0 && subtasks[0].type === TaskType.Execute) {
        allExecuteTasks.push(...subtasks);
      }
    }
  }

  // Validate ALL Execute tasks together to collect ALL missing config upfront
  if (allExecuteTasks.length > 0) {
    try {
      const validation = validateExecuteTasks(allExecuteTasks);

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
        // Missing config detected - create ONE Validate component for ALL missing config
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
              routeTasksAfterConfig(scheduledTasks, context);
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
  routeTasksAfterConfig(scheduledTasks, context);
}

/**
 * Task types that should appear in the upcoming display
 */
const UPCOMING_TASK_TYPES = [TaskType.Execute, TaskType.Answer];

/**
 * Collect names of all upcoming execution units (groups and standalone tasks)
 * for display during task execution
 */
function collectUpcomingNames(scheduledTasks: ScheduledTask[]): string[] {
  const names: string[] = [];
  let standaloneTasks: Task[] = [];

  const flushStandaloneTasks = () => {
    for (const task of standaloneTasks) {
      if (UPCOMING_TASK_TYPES.includes(task.type)) {
        names.push(task.action);
      }
    }
    standaloneTasks = [];
  };

  for (const task of scheduledTasks) {
    if (
      task.type === TaskType.Group &&
      task.subtasks &&
      task.subtasks.length > 0
    ) {
      flushStandaloneTasks();

      const subtasks = task.subtasks as Task[];
      const taskType = subtasks[0].type;

      if (UPCOMING_TASK_TYPES.includes(taskType)) {
        names.push(task.action);
      }
    } else {
      standaloneTasks.push(task as Task);
    }
  }

  flushStandaloneTasks();
  return names;
}

/**
 * Route tasks after config is complete (or when no config is needed)
 * Processes tasks in order, grouping by type
 */
function routeTasksAfterConfig(
  scheduledTasks: ScheduledTask[],
  context: RoutingContext
): void {
  // Collect all unit names for upcoming display
  const allUnitNames = collectUpcomingNames(scheduledTasks);
  let currentUnitIndex = 0;

  // Process tasks in order, preserving Group boundaries
  // Track consecutive standalone tasks to group them by type
  let consecutiveStandaloneTasks: Task[] = [];

  const processStandaloneTasks = () => {
    if (consecutiveStandaloneTasks.length === 0) return;

    // Group consecutive standalone tasks by type
    const tasksByType: Record<TaskType, Task[]> = {} as Record<
      TaskType,
      Task[]
    >;
    for (const type of Object.values(TaskType)) {
      tasksByType[type as TaskType] = [];
    }

    for (const task of consecutiveStandaloneTasks) {
      tasksByType[task.type].push(task);
    }

    // Route each type group
    for (const [type, typeTasks] of Object.entries(tasksByType)) {
      const taskType = type as TaskType;
      if (typeTasks.length === 0) continue;

      // For tasks that appear in upcoming, calculate from remaining units
      if (UPCOMING_TASK_TYPES.includes(taskType)) {
        // Each task advances the unit index
        for (const task of typeTasks) {
          const upcoming = allUnitNames.slice(currentUnitIndex + 1);
          currentUnitIndex++;
          routeTasksByType(taskType, [task], context, upcoming);
        }
      } else {
        routeTasksByType(taskType, typeTasks, context, []);
      }
    }

    consecutiveStandaloneTasks = [];
  };

  // Process tasks in original order
  for (const task of scheduledTasks) {
    if (task.type === TaskType.Group && task.subtasks) {
      // Process any accumulated standalone tasks first
      processStandaloneTasks();

      // Process Group as separate component
      if (task.subtasks.length > 0) {
        const subtasks = task.subtasks as Task[];
        const taskType = subtasks[0].type;

        // Calculate upcoming (all units after this one)
        const upcoming = UPCOMING_TASK_TYPES.includes(taskType)
          ? allUnitNames.slice(currentUnitIndex + 1)
          : [];
        if (UPCOMING_TASK_TYPES.includes(taskType)) {
          currentUnitIndex++;
        }

        routeTasksByType(taskType, subtasks, context, upcoming);
      }
    } else {
      // Accumulate standalone task
      consecutiveStandaloneTasks.push(task as Task);
    }
  }

  // Process any remaining standalone tasks
  processStandaloneTasks();
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
  upcoming: string[]
): void {
  context.workflowHandlers.addToQueue(
    createExecute({ tasks, service: context.service, upcoming })
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
