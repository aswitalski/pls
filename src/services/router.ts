import { BaseState, ComponentDefinition } from '../types/components.js';
import {
  LifecycleHandlers,
  RequestHandlers,
  WorkflowHandlers,
} from '../types/handlers.js';
import { asScheduledTasks } from '../types/guards.js';
import { FeedbackType, Task, TaskType } from '../types/types.js';

import { LLMService } from './anthropic.js';
import { saveConfigLabels } from './config-labels.js';
import {
  createAnswerDefinition,
  createConfigDefinitionWithKeys,
  createConfirmDefinition,
  createExecuteDefinition,
  createFeedback,
  createIntrospectDefinition,
  createMessage,
  createScheduleDefinition,
  createValidateDefinition,
} from './components.js';
import {
  getConfigSchema,
  saveConfig,
  unflattenConfig,
} from './configuration.js';
import {
  getCancellationMessage,
  getMixedTaskTypesError,
  getUnknownRequestMessage,
} from './messages.js';
import { validateExecuteTasks } from './validator.js';

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
    const message = createMessage(getUnknownRequestMessage());
    workflowHandlers.addToQueue(message);
    return;
  }

  const operation = getOperationName(validTasks);

  if (hasDefineTask) {
    // Has DEFINE tasks - add Schedule to queue for user selection
    // Refinement flow will call this function again with refined tasks
    const scheduleDefinition = createScheduleDefinition(message, validTasks);
    workflowHandlers.addToQueue(scheduleDefinition);
  } else {
    // No DEFINE tasks - Schedule auto-completes and adds Confirm to queue
    // When Schedule activates, Command moves to timeline
    // When Schedule completes, it moves to pending
    // When Confirm activates, Schedule stays pending (visible for context)
    const scheduleDefinition = createScheduleDefinition(
      message,
      validTasks,
      () => {
        // Schedule completed - add Confirm to queue
        const confirmDefinition = createConfirmDefinition(
          () => {
            // User confirmed - complete both Confirm and Schedule, then route to appropriate component
            lifecycleHandlers.completeActiveAndPending();
            executeTasksAfterConfirm(
              validTasks,
              service,
              userRequest,
              workflowHandlers,
              requestHandlers
            );
          },
          () => {
            // User cancelled - complete both Confirm and Schedule, then show cancellation
            lifecycleHandlers.completeActiveAndPending();
            const message = getCancellationMessage(operation);
            workflowHandlers.addToQueue(
              createFeedback(FeedbackType.Aborted, message)
            );
          }
        );
        workflowHandlers.addToQueue(confirmDefinition);
      }
    );

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
function executeTasksAfterConfirm<TState extends BaseState = BaseState>(
  tasks: Task[],
  service: LLMService,
  userRequest: string,
  workflowHandlers: WorkflowHandlers<ComponentDefinition>,
  requestHandlers: RequestHandlers<TState>
): void {
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

      routeTasksByType(
        taskType,
        typeTasks,
        service,
        userRequest,
        workflowHandlers,
        requestHandlers
      );
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
        routeTasksByType(
          taskType,
          subtasks,
          service,
          userRequest,
          workflowHandlers,
          requestHandlers
        );
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
 * Route tasks by type to appropriate components
 * Extracted to allow reuse for both Groups and standalone tasks
 */
function routeTasksByType<TState extends BaseState = BaseState>(
  taskType: TaskType,
  typeTasks: Task[],
  service: LLMService,
  userRequest: string,
  workflowHandlers: WorkflowHandlers<ComponentDefinition>,
  requestHandlers: RequestHandlers<TState>
): void {
  if (taskType === TaskType.Answer) {
    // Create separate Answer component for each question
    for (const task of typeTasks) {
      workflowHandlers.addToQueue(createAnswerDefinition(task.action, service));
    }
  } else if (taskType === TaskType.Introspect) {
    workflowHandlers.addToQueue(createIntrospectDefinition(typeTasks, service));
  } else if (taskType === TaskType.Config) {
    // Route to Config flow - extract keys and descriptions from task params
    const configKeys = typeTasks
      .map((task) => task.params?.key as string | undefined)
      .filter((key): key is string => key !== undefined);

    // Extract and cache labels from task descriptions
    // Only cache labels for dynamically discovered keys (not in schema)
    const schema = getConfigSchema();
    const labels: Record<string, string> = {};
    for (const task of typeTasks) {
      const key = task.params?.key as string | undefined;
      if (key && task.action && !(key in schema)) {
        labels[key] = task.action;
      }
    }
    if (Object.keys(labels).length > 0) {
      saveConfigLabels(labels);
    }

    workflowHandlers.addToQueue(
      createConfigDefinitionWithKeys(
        configKeys,
        (config: Record<string, string>) => {
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
        (operation: string) => {
          requestHandlers.onAborted(operation);
        }
      )
    );
  } else if (taskType === TaskType.Execute) {
    // Execute tasks with validation
    try {
      const validation = validateExecuteTasks(typeTasks);

      if (validation.validationErrors.length > 0) {
        // Show error feedback for invalid skills
        const errorMessages = validation.validationErrors.map((error) => {
          const issuesList = error.issues
            .map((issue) => `  - ${issue}`)
            .join('\n');
          return `Invalid skill definition "${error.skill}":\n\n${issuesList}`;
        });

        workflowHandlers.addToQueue(
          createFeedback(FeedbackType.Failed, errorMessages.join('\n\n'))
        );
      } else if (validation.missingConfig.length > 0) {
        workflowHandlers.addToQueue(
          createValidateDefinition(
            validation.missingConfig,
            userRequest,
            service,
            (error: string) => {
              requestHandlers.onError(error);
            },
            () => {
              workflowHandlers.addToQueue(
                createExecuteDefinition(typeTasks, service)
              );
            },
            (operation: string) => {
              requestHandlers.onAborted(operation);
            }
          )
        );
      } else {
        workflowHandlers.addToQueue(
          createExecuteDefinition(typeTasks, service)
        );
      }
    } catch (error) {
      // Handle skill reference errors (e.g., unknown skills)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const message = createMessage(errorMessage);
      workflowHandlers.addToQueue(message);
    }
  }
}
