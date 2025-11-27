import { ComponentName, ExitCode, FeedbackType } from '../types/types.js';
import { ComponentDefinition } from '../types/components.js';

import { createFeedback } from './components.js';
import { FeedbackMessages } from './messages.js';
import { exitApp } from './process.js';

/**
 * Type for queue handler callback that receives the first queue item and the rest of the queue
 * Can return a new queue or undefined
 */
export type QueueHandlerCallback = (
  first: ComponentDefinition,
  rest: ComponentDefinition[]
) => ComponentDefinition[] | undefined;

/**
 * Higher-order function that wraps queue handler logic with common patterns:
 * - Check if queue is empty
 * - Extract first element
 * - Optionally check component name
 * - Execute callback with first element
 * - Return new queue state
 */
export function withQueueHandler(
  componentName: ComponentName | null,
  callback: QueueHandlerCallback,
  shouldExit: boolean = false,
  exitCode: ExitCode = 0
) {
  return (currentQueue: ComponentDefinition[]): ComponentDefinition[] => {
    if (currentQueue.length === 0) return currentQueue;

    const [first, ...rest] = currentQueue;

    // If componentName is specified, check if it matches
    if (componentName && first.name !== componentName) {
      if (shouldExit) {
        exitApp(exitCode);
      }
      return [];
    }

    // Execute callback with first and rest
    const result = callback(first, rest);

    // Exit if specified
    if (shouldExit) {
      exitApp(exitCode);
    }

    // Return result or empty queue
    return result || [];
  };
}

/**
 * Creates a generic error handler for a component
 */
export function createErrorHandler(
  componentName: ComponentName,
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (error: string) =>
    withQueueHandler(
      componentName,
      (first) => {
        addToTimeline(
          first,
          createFeedback(
            FeedbackType.Failed,
            FeedbackMessages.UnexpectedError,
            error
          )
        );
        return undefined;
      },
      true,
      1
    );
}

/**
 * Creates a generic completion handler for a component
 */
export function createCompletionHandler(
  componentName: ComponentName,
  addToTimeline: (...items: ComponentDefinition[]) => void,
  onComplete: (first: ComponentDefinition) => void
) {
  return withQueueHandler(
    componentName,
    (first) => {
      onComplete(first);
      return undefined;
    },
    true,
    0
  );
}
