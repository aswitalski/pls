import { ReactNode, useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  Capability,
  ComponentStatus,
  IntrospectProps,
  IntrospectState,
} from '../types/components.js';
import { Origin } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { createReport } from '../services/components.js';
import { DebugLevel } from '../configuration/types.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

/**
 * Introspect view: Displays capabilities list
 */

export interface IntrospectViewProps {
  state: IntrospectState;
  status: ComponentStatus;
  children?: ReactNode;
}

export const IntrospectView = ({
  state,
  status,
  children,
}: IntrospectViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { error } = state;

  // Don't render wrapper when done and nothing to show
  if (!isActive && !error && !children) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isActive && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Listing capabilities. </Text>
          <Spinner />
        </Box>
      )}

      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}

      {children}
    </Box>
  );
};

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
  const [message, setMessage] = useState<string | null>(null);

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
          setMessage(message);

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

  const state: IntrospectState = {
    error,
    capabilities: capabilities || [],
    message,
  };
  return (
    <IntrospectView state={state} status={status}>
      {children}
    </IntrospectView>
  );
}
