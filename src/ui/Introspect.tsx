import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus, IntrospectProps } from '../types/components.js';

import { Colors, getTextColor } from '../services/colors.js';
import { createReportDefinition } from '../services/components.js';
import { DebugLevel } from '../services/configuration.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

export function Introspect({
  tasks,
  state: _state,
  status,
  service,
  children,
  debug = DebugLevel.None,
  stateHandlers,
  lifecycleHandlers,
  queueHandlers,
  errorHandlers,
  workflowHandlers,
}: IntrospectProps) {
  const isActive = status === ComponentStatus.Active;

  // isActive passed as prop
  const [error, setError] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (key.escape && isActive) {
        errorHandlers?.onAborted('introspection');
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
            workflowHandlers?.addToTimeline(...result.debug);
          }

          // Capabilities come directly from result - no parsing needed
          let capabilities = result.capabilities;

          // Filter out internal capabilities when not in debug mode
          if (debug === DebugLevel.None) {
            capabilities = capabilities.filter(
              (cap) =>
                cap.name.toUpperCase() !== 'SCHEDULE' &&
                cap.name.toUpperCase() !== 'VALIDATE' &&
                cap.name.toUpperCase() !== 'REPORT'
            );
          }

          // Save state before completing
          stateHandlers?.updateState({
            capabilities,
            message: result.message,
          });

          // Add Report component to queue
          queueHandlers?.addToQueue(
            createReportDefinition(result.message, capabilities)
          );

          // Signal completion
          lifecycleHandlers?.completeActive();
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);

          // Save error state
          stateHandlers?.updateState({
            error: errorMessage,
          });

          errorHandlers?.onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [tasks, isActive, service, debug]);

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
}
