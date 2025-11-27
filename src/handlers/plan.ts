import { StatefulComponentDefinition } from '../types/components.js';
import {
  ExecutionHandlers,
  HandlerOperations,
  PlanHandlers,
} from '../types/handlers.js';
import { ComponentName, FeedbackType, Task, TaskType } from '../types/types.js';

import {
  createConfirmDefinition,
  createFeedback,
  createPlanDefinition,
  createRefinement,
} from '../services/components.js';
import {
  FeedbackMessages,
  formatErrorMessage,
  getRefiningMessage,
} from '../services/messages.js';
import { exitApp } from '../services/process.js';

/**
 * Creates all plan handlers
 */
export function createPlanHandlers(
  ops: HandlerOperations,
  handleAborted: (operationName: string) => void,
  executionHandlers: ExecutionHandlers
): PlanHandlers {
  const onAborted = (operation: string) => {
    handleAborted(operation);
  };

  const createAbortHandler = (tasks: Task[]) => {
    const allIntrospect = tasks.every(
      (task) => task.type === TaskType.Introspect
    );
    if (allIntrospect) {
      return (operation: string) => {
        handleAborted(operation);
      };
    }
    return onAborted;
  };

  const onSelectionConfirmed = async (selectedTasks: Task[]) => {
    const refinementDef = createRefinement(
      getRefiningMessage(),
      (operation: string) => {
        handleAborted(operation);
      }
    ) as StatefulComponentDefinition;

    ops.setQueue((currentQueue) => {
      if (currentQueue.length === 0) return currentQueue;
      const [first] = currentQueue;
      if (first.name === ComponentName.Plan) {
        ops.addToTimeline(first);
      }
      return [refinementDef];
    });

    try {
      const service = ops.service;
      if (!service) {
        ops.addToTimeline(
          createFeedback(
            FeedbackType.Failed,
            FeedbackMessages.UnexpectedError,
            'Service not available'
          )
        );
        exitApp(1);
        return;
      }

      const refinedCommand = selectedTasks
        .map((task) => {
          const action = task.action.toLowerCase().replace(/,/g, ' -');
          const type = task.type;
          return `${action} (type: ${type})`;
        })
        .join(', ');

      const result = await service.processWithTool(refinedCommand, 'plan');

      ops.setQueue((currentQueue) => {
        if (
          currentQueue.length > 0 &&
          currentQueue[0].id === refinementDef.id
        ) {
          ops.addToTimeline(currentQueue[0]);
        }
        return [];
      });

      const planDefinition = createPlanDefinition(
        result.message,
        result.tasks,
        undefined
      );

      const confirmDefinition = createConfirmDefinition(
        () => {
          executionHandlers.onConfirmed(result.tasks);
        },
        () => {
          executionHandlers.onCancelled(result.tasks);
        }
      );

      ops.addToTimeline(planDefinition);
      ops.setQueue([confirmDefinition]);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);

      ops.setQueue((currentQueue) => {
        if (
          currentQueue.length > 0 &&
          currentQueue[0].id === refinementDef.id
        ) {
          ops.addToTimeline(currentQueue[0]);
        }
        return [];
      });

      ops.addToTimeline(
        createFeedback(
          FeedbackType.Failed,
          FeedbackMessages.UnexpectedError,
          errorMessage
        )
      );
      exitApp(1);
    }
  };

  return { onAborted, createAbortHandler, onSelectionConfirmed };
}
