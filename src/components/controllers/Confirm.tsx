import { useState } from 'react';

import {
  ComponentStatus,
  ConfirmProps,
  ConfirmState,
} from '../../types/components.js';

import { useInput } from '../../services/keyboard.js';

import { ConfirmView } from '../views/Confirm.js';

export { ConfirmView, ConfirmViewProps } from '../views/Confirm.js';

/**
 * Confirm controller: Manages yes/no selection
 */

export function Confirm({
  message,
  status,
  requestHandlers,
  onConfirmed,
  onCancelled,
}: ConfirmProps) {
  const isActive = status === ComponentStatus.Active;
  const [selectedIndex, setSelectedIndex] = useState(0); // 0 = Yes, 1 = No

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        // Escape: highlight "No" and cancel
        const finalState: ConfirmState = { selectedIndex: 1, confirmed: false };
        requestHandlers.onCompleted(finalState);
        onCancelled();
      } else if (key.tab) {
        // Toggle between Yes (0) and No (1)
        setSelectedIndex((prev) => (prev === 0 ? 1 : 0));
      } else if (key.return) {
        // Confirm selection
        const finalState: ConfirmState = {
          selectedIndex,
          confirmed: true,
        };
        requestHandlers.onCompleted(finalState);
        if (selectedIndex === 0) {
          onConfirmed();
        } else {
          onCancelled();
        }
      }
    },
    { isActive }
  );

  return (
    <ConfirmView
      status={status}
      message={message}
      selectedIndex={selectedIndex}
    />
  );
}
