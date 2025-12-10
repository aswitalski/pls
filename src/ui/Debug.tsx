import React from 'react';
import { Box, Text } from 'ink';

import { DebugProps } from '../types/components.js';

const MIN_CONTENT_WIDTH = 80;
const HORIZONTAL_PADDING = 2;
const BORDER_WIDTH = 1;

export const Debug = ({ title, content, color }: DebugProps) => {
  return (
    <Box
      flexDirection="column"
      paddingX={HORIZONTAL_PADDING}
      paddingY={1}
      borderStyle="single"
      borderColor={color}
      alignSelf="flex-start"
      minWidth={MIN_CONTENT_WIDTH + 2 * HORIZONTAL_PADDING + 2 * BORDER_WIDTH}
    >
      <Text color={color}>{title}</Text>
      <Text color={color}>{content}</Text>
    </Box>
  );
};
