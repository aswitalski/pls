import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  AnswerProps,
  AnswerState,
  ComponentStatus,
} from '../types/components.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { withMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MINIMUM_PROCESSING_TIME = 400;

/**
 * Answer view: Displays question and answer
 */
export interface AnswerViewProps {
  question: string;
  state: AnswerState;
  status: ComponentStatus;
}

export const AnswerView = ({ question, state, status }: AnswerViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { error, answer } = state;
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
};

/**
 * Answer controller: Fetches answer from LLM
 */

export function Answer({
  question,
  status,
  service,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: AnswerProps) {
  const isActive = status === ComponentStatus.Active;

  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  useInput(
    (input, key) => {
      if (key.escape && isActive) {
        requestHandlers.onAborted('answer');
      }
    },
    { isActive }
  );

  useEffect(() => {
    // Skip processing if done
    if (!isActive) {
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      try {
        // Call answer tool with minimum processing time for UX polish
        const result = await withMinimumTime(
          () => svc.processWithTool(question, 'answer'),
          MINIMUM_PROCESSING_TIME
        );

        if (mounted) {
          // Add debug components to timeline if present
          if (result.debug?.length) {
            workflowHandlers.addToTimeline(...result.debug);
          }

          // Extract answer from result
          const answerText = result.answer || '';
          setAnswer(answerText);

          // Expose final state
          const finalState: AnswerState = {
            answer: answerText,
            error: null,
          };
          requestHandlers.onCompleted(finalState);

          // Signal completion
          lifecycleHandlers.completeActive();
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);

          // Expose final state with error
          const finalState: AnswerState = {
            error: errorMessage,
            answer: null,
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
    question,
    isActive,
    service,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  ]);

  const state: AnswerState = { error, answer };
  return <AnswerView question={question} state={state} status={status} />;
}
