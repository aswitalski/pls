import React from 'react';
import { Box } from 'ink';

import { BaseState } from '../types/components.js';
import { useInput } from '../services/keyboard.js';

import { Message } from './Message.js';
import { Spinner } from './Spinner.js';

export interface RefinementProps {
  text: string;
  state?: BaseState;
  onAborted: () => void;
}

export const Refinement = ({ text, state, onAborted }: RefinementProps) => {
  const isDone = state?.done ?? false;

  useInput(
    (input, key) => {
      if (key.escape && !isDone) {
        onAborted();
        return;
      }
    },
    { isActive: !isDone }
  );

  return (
    <Box gap={1}>
      <Message text={text} />
      {!isDone && <Spinner />}
    </Box>
  );
};
