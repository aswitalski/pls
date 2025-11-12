import { Box, Text } from 'ink';

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

function getSymbolColor(type: FeedbackType): string {
  return {
    [FeedbackType.Info]: '#5c9ccc', // cyan
    [FeedbackType.Succeeded]: '#00aa00', // green
    [FeedbackType.Aborted]: '#cc9c5c', // orange
    [FeedbackType.Failed]: '#cc5c5c', // red
  }[type];
}

function getMessageColor(type: FeedbackType): string {
  return {
    [FeedbackType.Info]: '#aaaaaa', // light grey
    [FeedbackType.Succeeded]: '#5ccc5c', // green
    [FeedbackType.Aborted]: '#cc9c5c', // orange
    [FeedbackType.Failed]: '#cc5c5c', // red
  }[type];
}

export function Feedback({ type, message }: FeedbackProps) {
  const symbolColor = getSymbolColor(type);
  const messageColor = getMessageColor(type);
  const symbol = getSymbol(type);

  return (
    <Box>
      <Text color={symbolColor}>{symbol} </Text>
      <Text color={messageColor}>{message}</Text>
    </Box>
  );
}
