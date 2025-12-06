import React from 'react';
import { Box, Text } from 'ink';

import { MessageProps } from '../types/components.js';

export const Message = ({ text }: MessageProps) => {
  return (
    <Box marginLeft={1}>
      <Text>{text}</Text>
    </Box>
  );
};
