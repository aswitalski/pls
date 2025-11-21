import { Capability } from '../types/components.js';
import { HandlerOperations, IntrospectHandlers } from '../types/handlers.js';
import { ComponentName } from '../types/types.js';

import { createReportDefinition } from '../services/components.js';
import { createErrorHandler, withQueueHandler } from '../services/queue.js';

/**
 * Creates all introspect handlers
 */
export function createIntrospectHandlers(
  ops: HandlerOperations,
  handleAborted: (operationName: string) => void
): IntrospectHandlers {
  const onError = (error: string) => {
    ops.setQueue(
      createErrorHandler(ComponentName.Introspect, ops.addToTimeline)(error)
    );
  };

  const onComplete = (message: string, capabilities: Capability[]) => {
    ops.setQueue(
      withQueueHandler(
        ComponentName.Introspect,
        () => {
          ops.addToTimeline(createReportDefinition(message, capabilities));
          return undefined;
        },
        true,
        0
      )
    );
  };

  const onAborted = () => {
    handleAborted('Introspection');
  };

  return { onError, onComplete, onAborted };
}
