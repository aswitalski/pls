import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
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
 * Creates execute error handler
 */
export function createExecuteErrorHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (error: string) =>
    withQueueHandler(ComponentName.Execute, (first) => {
      addToTimeline(
        markAsDone(first as StatefulComponentDefinition),
        createFeedback(FeedbackType.Failed, error)
      );
      exitApp(1);
      return [];
    });
}

/**
 * Creates execute complete handler
 */
export function createExecuteCompleteHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (outputs: CommandOutput[], totalElapsed: number) =>
    withQueueHandler(ComponentName.Execute, (first) => {
      // Check if any command failed
      const failed = outputs.find(
        (out) => out.result !== ExecutionResult.Success
      );

      if (failed) {
        const errorMessage = failed.error
          ? `${failed.description}: ${failed.error}`
          : `${failed.description} failed`;

        addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(FeedbackType.Failed, errorMessage)
        );
        exitApp(1);
        return [];
      }

      // All succeeded
      addToTimeline(
        markAsDone(first as StatefulComponentDefinition),
        createMessage(`Execution completed in ${formatDuration(totalElapsed)}.`)
      );
      exitApp(0);
      return [];
    });
}

/**
 * Creates execute aborted handler
 */
export function createExecuteAbortedHandler(
  handleAborted: (operationName: string) => void
) {
  return () => {
    handleAborted('Execution');
  };
}
