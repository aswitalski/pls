import { ComponentDefinition } from '../types/components.js';
import { ComponentName } from '../types/types.js';

import { createAnswerDisplayDefinition } from '../services/components.js';
import { createErrorHandler, withQueueHandler } from '../services/queue.js';

/**
 * Creates answer error handler
 */
export function createAnswerErrorHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (error: string) =>
    createErrorHandler(ComponentName.Answer, addToTimeline)(error);
}

/**
 * Creates answer completion handler
 */
export function createAnswerCompleteHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (answer: string) =>
    withQueueHandler(
      ComponentName.Answer,
      () => {
        // Don't add the Answer component to timeline (it renders null)
        // Only add the AnswerDisplay component
        addToTimeline(createAnswerDisplayDefinition(answer));
        return undefined;
      },
      true,
      0
    );
}

/**
 * Creates answer aborted handler
 */
export function createAnswerAbortedHandler(
  handleAborted: (operationName: string) => void
) {
  return () => {
    handleAborted('Answer');
  };
}
