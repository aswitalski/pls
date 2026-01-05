import { useEffect, useState } from 'react';

import {
  AnswerProps,
  AnswerState,
  ComponentStatus,
} from '../../types/components.js';

import { useInput } from '../../services/keyboard.js';
import { formatErrorMessage } from '../../services/messages.js';
import { withMinimumTime } from '../../services/timing.js';

import { AnswerView } from '../views/Answer.js';

export { AnswerView, AnswerViewProps } from '../views/Answer.js';

const MINIMUM_PROCESSING_TIME = 400;

/**
 * Answer controller: Fetches answer from LLM
 */

export function Answer({
  question,
  status,
  service,
  upcoming,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: AnswerProps) {
  const isActive = status === ComponentStatus.Active;

  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useInput(
    (input, key) => {
      if (key.escape && isActive) {
        setCancelled(true);
        const finalState: AnswerState = {
          answer: null,
          error: null,
          cancelled: true,
        };
        requestHandlers.onCompleted(finalState);
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

  const lines = answer ? answer.split('\n') : null;

  return (
    <AnswerView
      status={status}
      question={question}
      lines={lines}
      error={error}
      upcoming={upcoming}
      cancelled={cancelled}
    />
  );
}
