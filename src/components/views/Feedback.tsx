import { Box, Text } from 'ink';

import { ComponentStatus, FeedbackProps } from '../../types/components.js';

import { getFeedbackColor } from '../../services/colors.js';

export function Feedback({ type, message }: FeedbackProps) {
  const color = getFeedbackColor(type, ComponentStatus.Done);

  return (
    <Box marginLeft={1}>
      <Text color={color}>{message}</Text>
    </Box>
  );
}
