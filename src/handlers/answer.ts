import { AnswerHandlers, HandlerOperations } from '../types/handlers.js';
import { ComponentName } from '../types/types.js';

import { createAnswerDisplayDefinition } from '../services/components.js';
import { createErrorHandler, withQueueHandler } from '../services/queue.js';

/**
 * Creates all answer handlers
 */
export function createAnswerHandlers(
  ops: HandlerOperations,
  handleAborted: (operationName: string) => void
): AnswerHandlers {
  const onError = (error: string) => {
    ops.setQueue(
      createErrorHandler(ComponentName.Answer, ops.addToTimeline)(error)
    );
  };

  const onComplete = (answer: string) => {
    ops.setQueue(
      withQueueHandler(
        ComponentName.Answer,
        () => {
          ops.addToTimeline(createAnswerDisplayDefinition(answer));
          return undefined;
        },
        true,
        0
      )
    );
  };

  const onAborted = () => {
    handleAborted('Answer');
  };

  return { onError, onComplete, onAborted };
}
