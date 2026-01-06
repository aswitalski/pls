import { useMemo } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { Colors, getTextColor } from '../../services/colors.js';
import { getAnswerLoadingMessage } from '../../services/messages.js';
import { ExecutionStatus } from '../../services/shell.js';

import { Spinner } from './Spinner.js';
import { Upcoming } from './Upcoming.js';

/**
 * Props for AnswerView - display-ready data
 */
export interface AnswerViewProps {
  status: ComponentStatus;
  question: string;
  lines: string[] | null;
  error: string | null;
  upcoming?: string[];
  cancelled?: boolean;
}

/**
 * Answer view: Displays question and answer
 */
export const AnswerView = ({
  status,
  question,
  lines,
  error,
  upcoming,
  cancelled = false,
}: AnswerViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const isLoading = isActive && !lines && !error;
  const loadingMessage = useMemo(() => getAnswerLoadingMessage(), []);

  // Determine upcoming status: cancelled, error, or pending
  const isTerminated = cancelled || error !== null;
  const upcomingStatus = cancelled
    ? ExecutionStatus.Aborted
    : error
      ? ExecutionStatus.Failed
      : ExecutionStatus.Pending;

  // Build full list of items to show - include current question when terminated
  const upcomingItems =
    isTerminated && upcoming ? [question, ...upcoming] : (upcoming ?? []);
  const showUpcoming = upcomingItems.length > 0 && (isActive || isTerminated);

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <>
          <Box marginLeft={1} marginBottom={1}>
            <Text color={getTextColor(isActive)}>{question}</Text>
          </Box>
          <Box paddingLeft={3} marginBottom={1}>
            <Text color={getTextColor(isActive)}>{loadingMessage} </Text>
            <Spinner />
          </Box>
        </>
      )}

      {lines && lines.length > 0 && (
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

      {showUpcoming && (
        <Box marginTop={lines && lines.length > 0 ? 1 : 0}>
          <Upcoming items={upcomingItems} status={upcomingStatus} />
        </Box>
      )}

      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
};
