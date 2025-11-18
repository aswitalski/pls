import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { AnswerProps } from '../types/components.js';

import { Colors, getTextColor } from '../services/colors.js';

import { Spinner } from './Spinner.js';

const MinimumProcessingTime = 400;

export function Answer({
  question,
  state,
  service,
  onError,
  onComplete,
  onAborted,
}: AnswerProps) {
  const done = state?.done ?? false;
  const isCurrent = done === false;
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
    // Skip processing if done
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
        // Call answer tool
        const result = await svc!.processWithTool(question, 'answer');
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MinimumProcessingTime - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          // Extract answer from result
          const answer = result.answer || '';
          setIsLoading(false);
          onComplete?.(answer);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MinimumProcessingTime - elapsed);

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
  }, [question, done, service, onComplete, onError]);

  // Return null when done (like Introspect)
  if (done || (!isLoading && !error)) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box>
          <Text color={getTextColor(isCurrent)}>Finding answer. </Text>
          <Spinner />
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
