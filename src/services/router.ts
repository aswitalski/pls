import {
  ErrorHandlers,
  QueueHandlers,
  WorkflowHandlers,
} from '../types/handlers.js';
import { asScheduledTasks } from '../types/guards.js';
import { FeedbackType, Task, TaskType } from '../types/types.js';

import { LLMService } from './anthropic.js';
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
import { saveConfig, unflattenConfig } from './configuration.js';
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
export function routeTasksWithConfirm(
  tasks: Task[],
  message: string,
  service: LLMService,
  userRequest: string,
  queueHandlers: QueueHandlers,
  workflowHandlers: WorkflowHandlers,
  errorHandlers: ErrorHandlers,
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
    queueHandlers.addToQueue(message);
    return;
  }

  const operation = getOperationName(validTasks);

  if (hasDefineTask) {
    // Has DEFINE tasks - add Schedule to queue for user selection
    // Refinement flow will call this function again with refined tasks
    const scheduleDefinition = createScheduleDefinition(message, validTasks);
    queueHandlers.addToQueue(scheduleDefinition);
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
            workflowHandlers.completeActiveAndPending();
            executeTasksAfterConfirm(
              validTasks,
              service,
              userRequest,
              queueHandlers,
              errorHandlers
            );
          },
          () => {
            // User cancelled - complete both Confirm and Schedule, then show cancellation
            workflowHandlers.completeActiveAndPending();
            const message = getCancellationMessage(operation);
            queueHandlers.addToQueue(
              createFeedback(FeedbackType.Aborted, message)
            );
          }
        );
        queueHandlers.addToQueue(confirmDefinition);
      }
    );

    queueHandlers.addToQueue(scheduleDefinition);
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
  service: LLMService,
  userRequest: string,
  queueHandlers: QueueHandlers,
  errorHandlers: ErrorHandlers
): void {
  // Validate task types (Groups must have uniform subtasks)
  try {
    validateTaskTypes(tasks);
  } catch (error) {
    errorHandlers.onError(
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
        queueHandlers,
        errorHandlers
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
          queueHandlers,
          errorHandlers
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
function routeTasksByType(
  taskType: TaskType,
  typeTasks: Task[],
  service: LLMService,
  userRequest: string,
  queueHandlers: QueueHandlers,
  errorHandlers: ErrorHandlers
): void {
  if (taskType === TaskType.Answer) {
    // Create separate Answer component for each question
    for (const task of typeTasks) {
      queueHandlers.addToQueue(createAnswerDefinition(task.action, service));
    }
  } else if (taskType === TaskType.Introspect) {
    queueHandlers.addToQueue(createIntrospectDefinition(typeTasks, service));
  } else if (taskType === TaskType.Config) {
    // Route to Config flow - extract keys from task params
    const configKeys = typeTasks
      .map((task) => task.params?.key as string | undefined)
      .filter((key): key is string => key !== undefined);

    queueHandlers.addToQueue(
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
          errorHandlers.onAborted(operation);
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

        queueHandlers.addToQueue(
          createFeedback(FeedbackType.Failed, errorMessages.join('\n\n'))
        );
      } else if (validation.missingConfig.length > 0) {
        queueHandlers.addToQueue(
          createValidateDefinition(
            validation.missingConfig,
            userRequest,
            service,
            (error: string) => {
              errorHandlers.onError(error);
            },
            () => {
              queueHandlers.addToQueue(
                createExecuteDefinition(typeTasks, service)
              );
            },
            (operation: string) => {
              errorHandlers.onAborted(operation);
            }
          )
        );
      } else {
        queueHandlers.addToQueue(createExecuteDefinition(typeTasks, service));
      }
    } catch (error) {
      // Handle skill reference errors (e.g., unknown skills)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const message = createMessage(errorMessage);
      queueHandlers.addToQueue(message);
    }
  }
}
