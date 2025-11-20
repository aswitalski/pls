import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { ComponentName, FeedbackType, Task, TaskType } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';
import {
  createConfirmDefinition,
  createFeedback,
  createPlanDefinition,
  markAsDone,
  createRefinement,
} from '../services/components.js';
import {
  FeedbackMessages,
  formatErrorMessage,
  getRefiningMessage,
} from '../services/messages.js';
import { exitApp } from '../services/process.js';

/**
 * Creates plan aborted handler
 */
export function createPlanAbortedHandler(
  handleAborted: (operationName: string) => void
) {
  return () => {
    handleAborted('Task selection');
  };
}

/**
 * Creates plan abort handler factory
 */
export function createPlanAbortHandlerFactory(
  handleAborted: (operationName: string) => void,
  handlePlanAborted: () => void
) {
  return (tasks: Task[]) => {
    const allIntrospect = tasks.every(
      (task) => task.type === TaskType.Introspect
    );
    if (allIntrospect) {
      return () => {
        handleAborted('Introspection');
      };
    }
    return handlePlanAborted;
  };
}

/**
 * Creates plan selection confirmed handler
 */
export function createPlanSelectionConfirmedHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void,
  service: LLMService,
  handleRefinementAborted: () => void,
  createPlanAbortHandler: (tasks: Task[]) => () => void,
  handleExecutionConfirmed: () => void,
  handleExecutionCancelled: () => void,
  setQueue: React.Dispatch<React.SetStateAction<ComponentDefinition[]>>
) {
  return async (selectedTasks: Task[]) => {
    // Mark current plan as done and add refinement to queue
    const refinementDef = createRefinement(
      getRefiningMessage(),
      handleRefinementAborted
    ) as StatefulComponentDefinition;

    setQueue((currentQueue) => {
      if (currentQueue.length === 0) return currentQueue;
      const [first] = currentQueue;
      if (first.name === ComponentName.Plan) {
        addToTimeline(markAsDone(first as StatefulComponentDefinition));
      }
      // Add refinement to queue so it becomes the active component
      return [refinementDef];
    });

    // Process refined command in background
    try {
      const refinedCommand = selectedTasks
        .map((task) => {
          const action = task.action.toLowerCase().replace(/,/g, ' -');
          const type = task.type;
          return `${action} (type: ${type})`;
        })
        .join(', ');

      const result = await service.processWithTool(refinedCommand, 'plan');

      // Mark refinement as done and move to timeline
      setQueue((currentQueue) => {
        if (
          currentQueue.length > 0 &&
          currentQueue[0].id === refinementDef.id
        ) {
          addToTimeline(
            markAsDone(currentQueue[0] as StatefulComponentDefinition)
          );
        }
        return [];
      });

      // Show final execution plan with confirmation
      const planDefinition = createPlanDefinition(
        result.message,
        result.tasks,
        createPlanAbortHandler(result.tasks),
        undefined
      );

      const confirmDefinition = createConfirmDefinition(
        handleExecutionConfirmed,
        handleExecutionCancelled
      );

      addToTimeline(planDefinition);
      setQueue([confirmDefinition]);
    } catch (error) {
      const errorMessage = formatErrorMessage(error);

      // Mark refinement as done and move to timeline before showing error
      setQueue((currentQueue) => {
        if (
          currentQueue.length > 0 &&
          currentQueue[0].id === refinementDef.id
        ) {
          addToTimeline(
            markAsDone(currentQueue[0] as StatefulComponentDefinition)
          );
        }
        return [];
      });

      addToTimeline(
        createFeedback(
          FeedbackType.Failed,
          FeedbackMessages.UnexpectedError,
          errorMessage
        )
      );
      exitApp(1);
    }
  };
}
