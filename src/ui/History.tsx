import React from 'react';
import { Box } from 'ink';

interface HistoryProps {
  items: React.ReactNode[];
}

export function History({ items }: HistoryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" gap={1}>
      {items.map((item, index) => (
        <Box key={index}>{item}</Box>
      ))}
    </Box>
  );
}
