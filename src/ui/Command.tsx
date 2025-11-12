import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { CommandProps } from '../types/components.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000; // purely for visual effect

export function Command({
  command,
  state,
  service,
  children,
  onError,
  onComplete,
  onAborted,
}: CommandProps) {
  const done = state?.done ?? false;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? !done);

  useInput(
    (input, key) => {
      if (key.escape && isLoading && !done) {
        setIsLoading(false);
        onAborted();
      }
    },
    { isActive: isLoading && !done }
  );

  useEffect(() => {
    // Skip processing if done (showing historical/final state)
    if (done) {
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
        const result = await svc!.processWithTool(command, 'plan');
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          setIsLoading(false);
          onComplete?.(result.message, result.tasks);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error occurred';
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
  }, [command, done, service]);

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      <Box>
        <Text color="gray">&gt; pls {command}</Text>
        {isLoading && (
          <>
            <Text> </Text>
            <Spinner />
          </>
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {children}
    </Box>
  );
}
