import { Capability, ComponentDefinition } from '../types/components.js';
import { ComponentName } from '../types/types.js';

import { createReportDefinition } from '../services/components.js';
import { createErrorHandler, withQueueHandler } from '../services/queue.js';

/**
 * Creates introspect error handler
 */
export function createIntrospectErrorHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (error: string) =>
    createErrorHandler(ComponentName.Introspect, addToTimeline)(error);
}

/**
 * Creates introspect completion handler
 */
export function createIntrospectCompleteHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return (message: string, capabilities: Capability[]) =>
    withQueueHandler(
      ComponentName.Introspect,
      () => {
        // Don't add the Introspect component to timeline (it renders null)
        // Only add the Report component
        addToTimeline(createReportDefinition(message, capabilities));
        return undefined;
      },
      true,
      0
    );
}

/**
 * Creates introspect aborted handler
 */
export function createIntrospectAbortedHandler(
  handleAborted: (operationName: string) => void
) {
  return () => {
    handleAborted('Introspection');
  };
}
