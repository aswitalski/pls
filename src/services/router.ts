import { ScheduledTask, Task, TaskType } from '../types/types.js';
import { Handlers } from '../types/components.js';

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
import { FeedbackType } from '../types/types.js';
import { validateExecuteTasks } from './validator.js';
import {
  getCancellationMessage,
  getMixedTaskTypesError,
  getUnknownRequestMessage,
} from './messages.js';

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
  handlers: Handlers,
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
    handlers.addToQueue(message);
    return;
  }

  const operation = getOperationName(validTasks);

  if (hasDefineTask) {
    // Has DEFINE tasks - add Schedule to queue for user selection
    // Refinement flow will call this function again with refined tasks
    const scheduleDefinition = createScheduleDefinition(message, validTasks);
    handlers.addToQueue(scheduleDefinition);
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
            handlers.completeActiveAndPending();
            executeTasksAfterConfirm(
              validTasks,
              service,
              userRequest,
              handlers
            );
          },
          () => {
            // User cancelled - complete both Confirm and Schedule, then show cancellation
            handlers.completeActiveAndPending();
            const message = getCancellationMessage(operation);
            handlers.addToQueue(createFeedback(FeedbackType.Aborted, message));
          }
        );
        handlers.addToQueue(confirmDefinition);
      }
    );

    handlers.addToQueue(scheduleDefinition);
  }
}

/**
 * Validate task types - allows mixed types at top level with Groups,
 * but each Group must have uniform subtask types
 */
function validateTaskTypes(tasks: Task[]): void {
  if (tasks.length === 0) return;

  // Cast to ScheduledTask to access subtasks property
  const scheduledTasks = tasks as unknown as ScheduledTask[];

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
  handlers: Handlers
): void {
  // Validate task types (Groups must have uniform subtasks)
  try {
    validateTaskTypes(tasks);
  } catch (error) {
    handlers.onError(error instanceof Error ? error.message : String(error));
    return;
  }

  // Flatten Group tasks to get actual executable subtasks
  const flattenedTasks: Task[] = [];
  const scheduledTasks = tasks as unknown as ScheduledTask[];

  for (const task of scheduledTasks) {
    if (task.type === TaskType.Group && task.subtasks) {
      // Add all subtasks from the group
      flattenedTasks.push(...(task.subtasks as Task[]));
    } else {
      // Add non-group tasks as-is
      flattenedTasks.push(task as Task);
    }
  }

  // Group flattened tasks by type - initialize all TaskType keys with empty arrays
  const tasksByType: Record<TaskType, Task[]> = {} as Record<TaskType, Task[]>;
  for (const type of Object.values(TaskType)) {
    tasksByType[type as TaskType] = [];
  }

  for (const task of flattenedTasks) {
    tasksByType[task.type].push(task);
  }

  // Route each type group appropriately
  for (const [type, typeTasks] of Object.entries(tasksByType)) {
    const taskType = type as TaskType;

    // Skip empty task groups (pre-initialized but unused)
    if (typeTasks.length === 0) {
      continue;
    }

    if (taskType === TaskType.Answer) {
      const question = typeTasks[0].action;
      handlers.addToQueue(createAnswerDefinition(question, service));
    } else if (taskType === TaskType.Introspect) {
      handlers.addToQueue(createIntrospectDefinition(typeTasks, service));
    } else if (taskType === TaskType.Config) {
      // Route to Config flow - extract keys from task params
      const configKeys = typeTasks
        .map((task) => task.params?.key as string | undefined)
        .filter((key): key is string => key !== undefined);

      handlers.addToQueue(
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
            handlers.onAborted(operation);
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

          handlers.addToQueue(
            createFeedback(FeedbackType.Failed, errorMessages.join('\n\n'))
          );
        } else if (validation.missingConfig.length > 0) {
          handlers.addToQueue(
            createValidateDefinition(
              validation.missingConfig,
              userRequest,
              service,
              (error: string) => {
                handlers.onError(error);
              },
              () => {
                handlers.addToQueue(
                  createExecuteDefinition(typeTasks, service)
                );
              },
              (operation: string) => {
                handlers.onAborted(operation);
              }
            )
          );
        } else {
          handlers.addToQueue(createExecuteDefinition(typeTasks, service));
        }
      } catch (error) {
        // Handle skill reference errors (e.g., unknown skills)
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const message = createMessage(errorMessage);
        handlers.addToQueue(message);
      }
    }
  }
}
