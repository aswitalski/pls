import { Box } from 'ink';

import { ComponentStatus } from '../../types/components.js';

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
