import { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { Palette } from '../../services/colors.js';

export interface StdinInputProps {
  isActive: boolean;
  onSubmit: (value: string) => void;
}

/**
 * Inline text input for forwarding user input to a running process.
 * Displays with a "> " prefix matching the codebase input style.
 */
export function StdinInput({ isActive, onSubmit }: StdinInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (text: string) => {
    onSubmit(text);
    setValue('');
  };

  if (!isActive) return null;

  return (
    <Box marginTop={1} marginLeft={5}>
      <Text color={Palette.Gray}>&gt; </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
