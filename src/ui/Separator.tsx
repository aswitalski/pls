import React from 'react';
import { Text } from 'ink';

interface SeparatorProps {
  color?: string;
  spaces?: number;
}

export const Separator: React.FC<SeparatorProps> = ({
  color = '#666666',
  spaces = 1,
}) => {
  const spacing = ' '.repeat(spaces);
  return (
    <Text color={color}>
      {spacing}›{spacing}
    </Text>
  );
};
