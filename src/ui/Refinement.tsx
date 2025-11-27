import { Box } from 'ink';

import { RefinementProps } from '../types/components.js';
import { useInput } from '../services/keyboard.js';

import { Message } from './Message.js';
import { Spinner } from './Spinner.js';

export const Refinement = ({
  text,
  isActive = true,
  onAborted,
}: RefinementProps) => {
  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        onAborted('plan refinement');
        return;
      }
    },
    { isActive }
  );

  return (
    <Box gap={1}>
      <Message text={text} />
      {isActive && <Spinner />}
    </Box>
  );
};
