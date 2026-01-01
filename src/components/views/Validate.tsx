import { Box, Text } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { Colors, getTextColor } from '../../services/colors.js';

import { Spinner } from './Spinner.js';

/**
 * Props for ValidateView - display-ready data
 */
export interface ValidateViewProps {
  status: ComponentStatus;
  completionMessage: string | null;
  error: string | null;
}

/**
 * Validate view: Displays validation and config prompt
 */
export const ValidateView = ({
  status,
  completionMessage,
  error,
}: ValidateViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const isLoading = isActive && !completionMessage && !error;

  // Don't render when not active and nothing to show
  if (!isActive && !completionMessage && !error) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>
            Validating configuration requirements.{' '}
          </Text>
          <Spinner />
        </Box>
      )}

      {completionMessage && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>{completionMessage}</Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
};
