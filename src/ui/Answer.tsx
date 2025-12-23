import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { AnswerProps, ComponentStatus } from '../types/components.js';

import { Colors, getTextColor } from '../services/colors.js';
import { addDebugToTimeline } from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { withMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MINIMUM_PROCESSING_TIME = 400;

export function Answer({
  question,
  state,
  status,
  service,
  handlers,
}: AnswerProps) {
  const isActive = status === ComponentStatus.Active;
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(state?.answer ?? null);

  useInput(
    (input, key) => {
      if (key.escape && isActive) {
        handlers?.onAborted('answer');
      }
    },
    { isActive }
  );

  useEffect(() => {
    // Skip processing if done
    if (!isActive) {
      return;
    }

    // Skip processing if no service available
    if (!service) {
      setError('No service available');
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
          // Add debug components to timeline if present
          addDebugToTimeline(result.debug, handlers);

          // Extract answer from result
          const answerText = result.answer || '';
          setAnswer(answerText);

          // Update component state so answer persists in timeline
          handlers?.updateState({
            answer: answerText,
          });

          // Signal completion
          handlers?.completeActive();
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);
          handlers?.updateState({
            error: errorMessage,
          });
          handlers?.onError(errorMessage);
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [question, isActive, service, handlers]);

  const lines = answer ? answer.split('\n') : [];

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isActive && !answer && !error && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Finding answer. </Text>
          <Spinner />
        </Box>
      )}

      {answer && (
        <>
          <Box marginLeft={1} marginBottom={1}>
            <Text color={getTextColor(isActive)}>{question}</Text>
          </Box>
          <Box flexDirection="column" paddingLeft={3}>
            {lines.map((line, index) => (
              <Text color={getTextColor(isActive)} key={index}>
                {line}
              </Text>
            ))}
          </Box>
        </>
      )}

      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
