import React from 'react';
import { Box, Text } from 'ink';

export interface MessageProps {
  text: string;
}

export const Message = ({ text }: MessageProps) => {
  return (
    <Box>
      <Text>{text}</Text>
    </Box>
  );
};
