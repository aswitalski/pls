import { Task, TaskType } from '../types/types.js';
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
  createPlanDefinition,
  createValidateDefinition,
} from './components.js';
import { saveConfig, unflattenConfig } from './configuration.js';
import { FeedbackType } from '../types/types.js';
import { validateExecuteTasks } from './execution-validator.js';
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
    // Has DEFINE tasks - add Plan to queue for user selection
    // Refinement flow will call this function again with refined tasks
    const planDefinition = createPlanDefinition(message, validTasks);
    handlers.addToQueue(planDefinition);
  } else {
    // No DEFINE tasks - Plan auto-completes and adds Confirm to queue
    // When Plan activates, Command moves to timeline
    // When Plan completes, it moves to pending
    // When Confirm activates, Plan stays pending (visible for context)
    const planDefinition = createPlanDefinition(message, validTasks, () => {
      // Plan completed - add Confirm to queue
      const confirmDefinition = createConfirmDefinition(
        () => {
          // User confirmed - complete both Confirm and Plan, then route to appropriate component
          handlers.completeActiveAndPending();
          executeTasksAfterConfirm(validTasks, service, userRequest, handlers);
        },
        () => {
          // User cancelled - complete both Confirm and Plan, then show cancellation
          handlers.completeActiveAndPending();
          const message = getCancellationMessage(operation);
          handlers.addToQueue(createFeedback(FeedbackType.Aborted, message));
        }
      );
      handlers.addToQueue(confirmDefinition);
    });

    handlers.addToQueue(planDefinition);
  }
}

/**
 * Validate that all tasks have the same type
 * Per FLOWS.md: "Mixed types → Error (not supported)"
 */
function validateTaskTypes(tasks: Task[]): void {
  if (tasks.length === 0) return;

  const types = new Set(tasks.map((task) => task.type));
  if (types.size > 1) {
    throw new Error(getMixedTaskTypesError(Array.from(types)));
  }
}

/**
 * Execute tasks after confirmation (internal helper)
 * Validates task types after user has seen and confirmed the plan
 */
function executeTasksAfterConfirm(
  tasks: Task[],
  service: LLMService,
  userRequest: string,
  handlers: Handlers
): void {
  // Validate all tasks have the same type after user confirmation
  // Per FLOWS.md: "Confirm component completes → Execution handler analyzes task types"
  try {
    validateTaskTypes(tasks);
  } catch (error) {
    handlers.onError(error instanceof Error ? error.message : String(error));
    return;
  }

  const allIntrospect = tasks.every(
    (task) => task.type === TaskType.Introspect
  );
  const allAnswer = tasks.every((task) => task.type === TaskType.Answer);
  const allConfig = tasks.every((task) => task.type === TaskType.Config);

  if (allAnswer) {
    const question = tasks[0].action;
    handlers.addToQueue(createAnswerDefinition(question, service));
  } else if (allIntrospect) {
    handlers.addToQueue(createIntrospectDefinition(tasks, service));
  } else if (allConfig) {
    // Route to Config flow - extract keys from task params
    const configKeys = tasks
      .map((task) => task.params?.key as string | undefined)
      .filter((key): key is string => key !== undefined);

    handlers.addToQueue(
      createConfigDefinitionWithKeys(
        configKeys,
        (config: Record<string, string>) => {
          // Save config using the same pattern as Validate component
          try {
            // Convert flat dotted keys to nested structure grouped by section
            const configBySection = unflattenConfig(config);

            // Save each section
            for (const [section, sectionConfig] of Object.entries(
              configBySection
            )) {
              saveConfig(section, sectionConfig);
            }

            handlers.completeActive();
            handlers.addToQueue(
              createFeedback(
                FeedbackType.Succeeded,
                'Configuration updated successfully.'
              )
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : 'Failed to save configuration';
            handlers.onError(errorMessage);
          }
        },
        (operation: string) => {
          handlers.onAborted(operation);
        }
      )
    );
  } else {
    // Execute tasks with validation
    try {
      const validation = validateExecuteTasks(tasks);

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
              handlers.addToQueue(createExecuteDefinition(tasks, service));
            },
            (operation: string) => {
              handlers.onAborted(operation);
            }
          )
        );
      } else {
        handlers.addToQueue(createExecuteDefinition(tasks, service));
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
