import React from 'react';
import { Text } from 'ink';

export interface MessageProps {
  text: string;
}

export const Message = ({ text }: MessageProps) => {
  return <Text>{text}</Text>;
};
