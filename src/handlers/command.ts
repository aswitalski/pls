import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { ComponentName, Task, TaskType } from '../types/types.js';

import {
  createConfirmDefinition,
  createPlanDefinition,
  markAsDone,
} from '../services/components.js';

import { createErrorHandler, withQueueHandler } from '../services/queue.js';

/**
 * Creates command error handler
 */
export function createCommandErrorHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (error: string) =>
    createErrorHandler(ComponentName.Command, addToTimeline)(error);
}

/**
 * Creates command completion handler
 */
export function createCommandCompleteHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void,
  createPlanAbortHandler: (tasks: Task[]) => () => void,
  handlePlanSelectionConfirmed: (tasks: Task[]) => Promise<void>,
  handleExecutionConfirmed: () => void,
  handleExecutionCancelled: () => void
) {
  return (message: string, tasks: Task[]) =>
    withQueueHandler(
      ComponentName.Command,
      (first) => {
        // Check if tasks contain a Define task that requires user interaction
        const hasDefineTask = tasks.some(
          (task) => task.type === TaskType.Define
        );

        const planDefinition = createPlanDefinition(
          message,
          tasks,
          createPlanAbortHandler(tasks),
          hasDefineTask ? handlePlanSelectionConfirmed : undefined
        );

        if (hasDefineTask) {
          // Don't exit - keep the plan in the queue for interaction
          addToTimeline(markAsDone(first as StatefulComponentDefinition));
          return [planDefinition];
        } else {
          // No define task - show plan and confirmation
          const confirmDefinition = createConfirmDefinition(
            handleExecutionConfirmed,
            handleExecutionCancelled
          );
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            planDefinition
          );
          return [confirmDefinition];
        }
      },
      false,
      0
    );
}

/**
 * Creates command aborted handler
 */
export function createCommandAbortedHandler(
  handleAborted: (operationName: string) => void
) {
  return () => {
    handleAborted('Request');
  };
}
