import { Box, Text } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { Colors, getTextColor } from '../../services/colors.js';

import { Spinner } from './Spinner.js';

/**
 * Props for AnswerView - display-ready data
 */
export interface AnswerViewProps {
  status: ComponentStatus;
  question: string;
  lines: string[] | null;
  error: string | null;
}

/**
 * Answer view: Displays question and answer
 */
export const AnswerView = ({
  status,
  question,
  lines,
  error,
}: AnswerViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const isLoading = isActive && !lines && !error;
  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Finding answer. </Text>
          <Spinner />
        </Box>
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

      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
};
