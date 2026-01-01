import { useEffect, useState } from 'react';

import {
  Capability,
  ComponentStatus,
  IntrospectProps,
  IntrospectState,
} from '../../types/components.js';
import { Origin } from '../../types/types.js';

import { createReport } from '../../services/components.js';
import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';
import { formatErrorMessage } from '../../services/messages.js';
import { ensureMinimumTime } from '../../services/timing.js';

import { IntrospectView } from '../views/Introspect.js';

export { IntrospectView, IntrospectViewProps } from '../views/Introspect.js';

const MIN_PROCESSING_TIME = 1000;

/**
 * Introspect controller: Lists capabilities via LLM
 */

export function Introspect({
  tasks,
  status,
  service,
  children,
  debug = DebugLevel.None,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: IntrospectProps) {
  const isActive = status === ComponentStatus.Active;

  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null);

  useInput(
    (input, key) => {
      if (key.escape && isActive) {
        requestHandlers.onAborted('introspection');
      }
    },
    { isActive }
  );

  useEffect(() => {
    // Skip processing if not active
    if (!isActive) {
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        // Get the introspect task action (first task should have the intro message)
        const introspectAction = tasks[0]?.action || 'list capabilities';

        // Call introspect tool
        const result = await svc.processWithTool(
          introspectAction,
          'introspect'
        );

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Add debug components to timeline if present
          if (result.debug?.length) {
            workflowHandlers.addToTimeline(...result.debug);
          }

          // Destructure message from result
          const { message } = result;

          // Filter out meta workflow capabilities when not in debug mode
          const capabilities =
            debug === DebugLevel.None
              ? result.capabilities.filter(
                  (cap) => cap.origin !== Origin.Indirect
                )
              : result.capabilities;

          setCapabilities(capabilities);

          const finalState: IntrospectState = {
            error: null,
            capabilities,
            message,
          };
          requestHandlers.onCompleted(finalState);

          // Add Report component to queue
          workflowHandlers.addToQueue(createReport({ message, capabilities }));

          // Signal completion
          lifecycleHandlers.completeActive();
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);

          const finalState: IntrospectState = {
            error: errorMessage,
            capabilities: [],
            message: null,
          };
          requestHandlers.onCompleted(finalState);

          requestHandlers.onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [
    tasks,
    isActive,
    service,
    debug,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  ]);

  const hasCapabilities = capabilities !== null && capabilities.length > 0;

  return (
    <IntrospectView
      status={status}
      hasCapabilities={hasCapabilities}
      error={error}
    >
      {children}
    </IntrospectView>
  );
}
