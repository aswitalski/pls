import { Task, TaskType } from '../types/types.js';
import { Handlers } from '../types/components.js';

import { LLMService } from './anthropic.js';
import {
  createAnswerDefinition,
  createConfirmDefinition,
  createExecuteDefinition,
  createIntrospectDefinition,
  createPlanDefinition,
  createValidateDefinition,
} from './components.js';
import { validateExecuteTasks } from './execution-validator.js';

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

  const operation = getOperationName(tasks);

  // Create plan definition
  const planDefinition = createPlanDefinition(message, tasks);

  if (hasDefineTask) {
    // Has DEFINE tasks - add Plan to queue for user selection
    // Refinement flow will call this function again with refined tasks
    handlers.addToQueue?.(planDefinition);
  } else {
    // No DEFINE tasks - add Plan to timeline, create Confirm
    const confirmDefinition = createConfirmDefinition(
      () => {
        // User confirmed - route to appropriate component
        handlers.completeActive?.();
        executeTasksAfterConfirm(tasks, service, userRequest, handlers);
      },
      () => {
        // User cancelled
        handlers.onAborted(operation);
      }
    );

    handlers.addToTimeline?.(planDefinition);
    handlers.addToQueue?.(confirmDefinition);
  }
}

/**
 * Execute tasks after confirmation (internal helper)
 */
function executeTasksAfterConfirm(
  tasks: Task[],
  service: LLMService,
  userRequest: string,
  handlers: Handlers
): void {
  const allIntrospect = tasks.every(
    (task) => task.type === TaskType.Introspect
  );
  const allAnswer = tasks.every((task) => task.type === TaskType.Answer);

  if (allAnswer) {
    const question = tasks[0].action;
    handlers.addToQueue?.(createAnswerDefinition(question, service));
  } else if (allIntrospect) {
    handlers.addToQueue?.(createIntrospectDefinition(tasks, service));
  } else {
    // Execute tasks with validation
    const missingConfig = validateExecuteTasks(tasks);

    if (missingConfig.length > 0) {
      handlers.addToQueue?.(
        createValidateDefinition(
          missingConfig,
          userRequest,
          service,
          (error: string) => {
            handlers.onError(error);
          },
          () => {
            handlers.addToQueue?.(createExecuteDefinition(tasks, service));
          },
          (operation: string) => {
            handlers.onAborted(operation);
          }
        )
      );
    } else {
      handlers.addToQueue?.(createExecuteDefinition(tasks, service));
    }
  }
}
