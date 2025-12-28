import { Box } from 'ink';

import { ComponentStatus, RefinementProps } from '../types/components.js';

import { useInput } from '../services/keyboard.js';

import { Message } from './Message.js';
import { Spinner } from './Spinner.js';

/**
 * Refinement view: Displays refinement message with spinner
 */
export interface RefinementViewProps {
  text: string;
  status: ComponentStatus;
}

export const RefinementView = ({ text, status }: RefinementViewProps) => {
  const isActive = status === ComponentStatus.Active;

  return (
    <Box gap={1}>
      <Message text={text} status={status} />
      {isActive && <Spinner />}
    </Box>
  );
};

/**
 * Refinement controller: Handles abort input
 */
export const Refinement = ({ text, status, onAborted }: RefinementProps) => {
  const isActive = status === ComponentStatus.Active;

  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        onAborted('plan refinement');
        return;
      }
    },
    { isActive }
  );

  return <RefinementView text={text} status={status} />;
};
