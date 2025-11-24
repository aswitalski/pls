import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { AnswerProps } from '../types/components.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { withMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MINIMUM_PROCESSING_TIME = 400;

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
      try {
        // Call answer tool with minimum processing time for UX polish
        const result = await withMinimumTime(
          () => svc!.processWithTool(question, 'answer'),
          MINIMUM_PROCESSING_TIME
        );

        if (mounted) {
          // Extract answer from result
          const answer = result.answer || '';
          setIsLoading(false);
          onComplete?.(answer);
        }
      } catch (err) {
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
