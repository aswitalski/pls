import { ComponentStatus, RefinementProps } from '../../types/components.js';

import { useInput } from '../../services/keyboard.js';

import { RefinementView } from '../views/Refinement.js';

export { RefinementView, RefinementViewProps } from '../views/Refinement.js';

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
