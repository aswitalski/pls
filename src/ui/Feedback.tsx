import { Box, Text } from 'ink';

import { FeedbackColors } from '../types/colors.js';
import { FeedbackProps } from '../types/components.js';
import { FeedbackType } from '../types/types.js';

function getSymbol(type: FeedbackType): string {
  return {
    [FeedbackType.Info]: 'ℹ',
    [FeedbackType.Succeeded]: '✓',
    [FeedbackType.Aborted]: '⊘',
    [FeedbackType.Failed]: '✗',
  }[type];
}

export function Feedback({ type, message }: FeedbackProps) {
  const color = FeedbackColors[type];
  const symbol = getSymbol(type);

  return (
    <Box>
      <Text color={color}>
        {symbol} {message}
      </Text>
    </Box>
  );
}
