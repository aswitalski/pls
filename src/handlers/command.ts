import { StatefulComponentDefinition } from '../types/components.js';
import {
  CommandHandlers,
  ExecutionHandlers,
  HandlerOperations,
  PlanHandlers,
} from '../types/handlers.js';
import { ComponentName, Task, TaskType } from '../types/types.js';

import {
  createConfirmDefinition,
  createPlanDefinition,
  markAsDone,
} from '../services/components.js';
import { createErrorHandler, withQueueHandler } from '../services/queue.js';

/**
 * Creates all command handlers
 */
export function createCommandHandlers(
  ops: HandlerOperations,
  handleAborted: (operationName: string) => void,
  planHandlers: PlanHandlers,
  executionHandlers: ExecutionHandlers
): CommandHandlers {
  const onError = (error: string) => {
    ops.setQueue(
      createErrorHandler(ComponentName.Command, ops.addToTimeline)(error)
    );
  };

  const onComplete = (message: string, tasks: Task[]) => {
    ops.setQueue(
      withQueueHandler(
        ComponentName.Command,
        (first) => {
          const hasDefineTask = tasks.some(
            (task) => task.type === TaskType.Define
          );

          const planDefinition = createPlanDefinition(
            message,
            tasks,
            planHandlers.createAbortHandler(tasks),
            hasDefineTask ? planHandlers.onSelectionConfirmed : undefined
          );

          if (hasDefineTask) {
            ops.addToTimeline(markAsDone(first as StatefulComponentDefinition));
            return [planDefinition];
          } else {
            const confirmDefinition = createConfirmDefinition(
              () => {
                executionHandlers.onConfirmed(tasks);
              },
              () => {
                executionHandlers.onCancelled(tasks);
              }
            );
            ops.addToTimeline(
              markAsDone(first as StatefulComponentDefinition),
              planDefinition
            );
            return [confirmDefinition];
          }
        },
        false,
        0
      )
    );
  };

  const onAborted = () => {
    handleAborted('Request');
  };

  return { onError, onComplete, onAborted };
}
