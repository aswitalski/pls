import React from 'react';
import { Box, Text } from 'ink';

import { AnswerDisplayProps } from '../types/components.js';

export function AnswerDisplay({ answer }: AnswerDisplayProps) {
  // Split answer into lines and display with indentation
  const lines = answer.split('\n');

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {lines.map((line, index) => (
        <Text key={index}>{line}</Text>
      ))}
    </Box>
  );
}
