import { FC } from 'react';
import { Text } from 'ink';

import { Colors } from '../../services/colors.js';

interface SeparatorProps {
  color?: string;
  spaces?: number;
}

export const Separator: FC<SeparatorProps> = ({
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
