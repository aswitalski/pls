import React from 'react';
import { Text } from 'ink';

import { Colors } from '../types/colors.js';

interface SeparatorProps {
  color?: string;
  spaces?: number;
}

export const Separator: React.FC<SeparatorProps> = ({
  color = Colors.Label.Discarded,
  spaces = 1,
}) => {
  const spacing = ' '.repeat(spaces);
  return (
    <Text color={color}>
      {spacing}›{spacing}
    </Text>
  );
};
