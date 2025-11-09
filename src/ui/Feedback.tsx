import { Box, Text } from 'ink';

import { FeedbackProps, FeedbackType } from '../types/components.js';

function getSymbol(type: FeedbackType): string {
  return {
    [FeedbackType.Succeeded]: '✓',
    [FeedbackType.Aborted]: '⊘',
    [FeedbackType.Failed]: '✗',
  }[type];
}

function getColor(type: FeedbackType): string {
  return {
    [FeedbackType.Succeeded]: '#00aa00', // green
    [FeedbackType.Aborted]: '#cc9c5c', // orange
    [FeedbackType.Failed]: '#aa0000', // red
  }[type];
}

export function Feedback({ type, message }: FeedbackProps) {
  const color = getColor(type);
  const symbol = getSymbol(type);

  return (
    <Box marginLeft={1}>
      <Text color={color}>
        {symbol} {message}
      </Text>
    </Box>
  );
}
