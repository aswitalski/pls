import React from 'react';
import { Box, Text } from 'ink';

import { DebugProps } from '../../types/components.js';

const CONTENT_WIDTH = 80;
const HORIZONTAL_PADDING = 2;

export const Debug = ({ title, content, color }: DebugProps) => {
  return (
    <Box
      flexDirection="column"
      paddingX={HORIZONTAL_PADDING}
      paddingY={1}
      borderStyle="single"
      borderColor={color}
      width={CONTENT_WIDTH}
    >
      <Text color={color} wrap="wrap">
        {title}
      </Text>
      <Text color={color} wrap="wrap">
        {content}
      </Text>
    </Box>
  );
};
