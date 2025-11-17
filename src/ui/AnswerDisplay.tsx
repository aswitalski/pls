import React from 'react';
import { Box, Text } from 'ink';

import { AnswerDisplayProps } from '../types/components.js';
import { Colors } from '../services/colors.js';

export function AnswerDisplay({ answer }: AnswerDisplayProps) {
  // Split answer into lines and display with indentation
  const lines = answer.split('\n');

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {lines.map((line, index) => (
        <Text color={Colors.Text.Active} key={index}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
