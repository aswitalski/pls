import { StatefulComponentDefinition } from '../types/components.js';
import { ExecuteHandlers, HandlerOperations } from '../types/handlers.js';
import { ComponentName, FeedbackType } from '../types/types.js';

import {
  createFeedback,
  createMessage,
  markAsDone,
} from '../services/components.js';
import { formatDuration } from '../services/messages.js';
import { exitApp } from '../services/process.js';
import { CommandOutput, ExecutionResult } from '../services/shell.js';
import { withQueueHandler } from '../services/queue.js';

/**
 * Creates all execute handlers
 */
export function createExecuteHandlers(
  ops: HandlerOperations,
  handleAborted: (operationName: string) => void
): ExecuteHandlers {
  void handleAborted;
  const onError = (error: string) => {
    ops.setQueue(
      withQueueHandler(ComponentName.Execute, (first) => {
        ops.addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(FeedbackType.Failed, error)
        );
        exitApp(1);
        return [];
      })
    );
  };

  const onComplete = (outputs: CommandOutput[], totalElapsed: number) => {
    ops.setQueue(
      withQueueHandler(ComponentName.Execute, (first) => {
        const failed = outputs.find(
          (out) => out.result !== ExecutionResult.Success
        );

        if (failed) {
          const errorMessage = failed.error
            ? `${failed.description}: ${failed.error}`
            : `${failed.description} failed`;

          ops.addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(FeedbackType.Failed, errorMessage)
          );
          exitApp(1);
          return [];
        }

        ops.addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createMessage(
            `Execution completed in ${formatDuration(totalElapsed)}.`
          )
        );
        exitApp(0);
        return [];
      })
    );
  };

  const onAborted = (elapsedTime: number) => {
    ops.setQueue(
      withQueueHandler(ComponentName.Execute, (first) => {
        const message =
          elapsedTime > 0
            ? `The execution was cancelled after ${formatDuration(elapsedTime)}.`
            : 'The execution was cancelled.';

        ops.addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(FeedbackType.Aborted, message)
        );
        exitApp(0);
        return [];
      })
    );
  };

  return { onError, onComplete, onAborted };
}
