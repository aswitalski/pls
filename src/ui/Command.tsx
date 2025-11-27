import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { CommandProps } from '../types/components.js';
import { TaskType } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000; // purely for visual effect

export function Command({
  command,
  state,
  isActive = true,
  service,
  children,
  onError,
  onComplete,
  onAborted,
}: CommandProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? isActive);

  useInput(
    (input, key) => {
      if (key.escape && isLoading && isActive) {
        setIsLoading(false);
        onAborted('request');
      }
    },
    { isActive: isLoading && isActive }
  );

  useEffect(() => {
    // Skip processing if not active (showing historical/final state)
    if (!isActive) {
      return;
    }

    // Skip processing if no service available
    if (!service) {
      setError('No service available');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        let result = await svc!.processWithTool(command, 'plan');

        // If all tasks are config type, delegate to CONFIG tool
        const allConfig =
          result.tasks.length > 0 &&
          result.tasks.every((task) => task.type === TaskType.Config);

        if (allConfig) {
          // Extract query from first config task params, default to 'app'
          const query =
            (result.tasks[0].params?.query as string | undefined) || 'app';
          // Call CONFIG tool to get specific config keys
          result = await svc!.processWithTool(query, 'config');
        }

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          setIsLoading(false);
          onComplete?.(result.message, result.tasks);
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setIsLoading(false);
          if (onError) {
            onError(errorMessage);
          } else {
            setError(errorMessage);
          }
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [command, isActive, service]);

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      <Box
        paddingX={!isActive ? 1 : 0}
        marginX={!isActive ? -1 : 0}
        backgroundColor={!isActive ? Colors.Background.UserQuery : undefined}
      >
        <Text color={isActive ? Colors.Text.Active : Colors.Text.UserQuery}>
          &gt; pls {command}
        </Text>
        {isLoading && (
          <>
            <Text> </Text>
            <Spinner />
          </>
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}

      {children}
    </Box>
  );
}
