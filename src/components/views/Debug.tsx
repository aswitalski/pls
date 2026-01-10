import React from 'react';
import { Box, Text } from 'ink';

import { DebugProps } from '../../types/components.js';

const CONTENT_WIDTH = 80;
const HORIZONTAL_PADDING = 2;

export const Debug = ({ title, content, color }: DebugProps) => {
  // Plain text content - single bordered box
  if (typeof content === 'string') {
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
  }

  // Array content - table with one column, each item in bordered row
  return (
    <Box flexDirection="column" width={CONTENT_WIDTH}>
      <Box
        paddingX={HORIZONTAL_PADDING}
        paddingY={1}
        borderStyle="single"
        borderColor={color}
        width={CONTENT_WIDTH}
      >
        <Text color={color} wrap="wrap">
          {title}
        </Text>
      </Box>
      {content.map((section, index) => (
        <Box
          key={index}
          paddingX={HORIZONTAL_PADDING}
          paddingY={1}
          borderStyle="single"
          borderColor={color}
          width={CONTENT_WIDTH}
          marginTop={-1}
        >
          <Text color={color} wrap="wrap">
            {section}
          </Text>
        </Box>
      ))}
    </Box>
  );
};
