import React from 'react';
import { Box, Text, useInput } from 'ink';

import { ProgressProps } from '../types/components.js';

import { Palette } from '../services/colors.js';

import { Spinner } from './Spinner.js';

export const Progress = ({
  message,
  done = false,
  handlers,
}: ProgressProps) => {
  const isActive = !done;

  useInput(
    (input, key) => {
      if (!isActive || !handlers) return;

      if (key.return) {
        // Enter - complete
        handlers.onComplete();
      } else if (key.escape) {
        // Esc - abort
        handlers.onAborted('progress');
      } else if (input === 'e') {
        // 'e' - error
        handlers.onError('Test error triggered by user');
      }
    },
    { isActive: isActive && !!handlers }
  );

  if (!isActive) {
    return null;
  }

  return (
    <Box gap={1} marginLeft={1}>
      <Text>{message}</Text>
      <Spinner />
    </Box>
  );
};
