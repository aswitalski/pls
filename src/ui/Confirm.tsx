import React from 'react';
import { Box, Text, useInput } from 'ink';

import { Panel } from './Panel.js';

export interface ConfirmProps {
  message: string;
  state?: ConfirmState;
  onConfirmed?: () => void;
  onCancelled?: () => void;
}

export interface ConfirmState {
  done: boolean;
  confirmed?: boolean;
}

export function Confirm({
  message,
  state,
  onConfirmed,
  onCancelled,
}: ConfirmProps) {
  const done = state?.done ?? false;
  const [selectedIndex, setSelectedIndex] = React.useState(0); // 0 = Yes, 1 = No

  useInput(
    (input, key) => {
      if (done) return;

      if (key.tab) {
        // Toggle between Yes (0) and No (1)
        setSelectedIndex((prev) => (prev === 0 ? 1 : 0));
      } else if (key.return) {
        // Confirm selection
        if (selectedIndex === 0) {
          onConfirmed?.();
        } else {
          onCancelled?.();
        }
      }
    },
    { isActive: !done }
  );

  const options = [
    { label: 'Yes', value: 'yes' },
    { label: 'No', value: 'no' },
  ];

  return (
    <Box alignSelf="flex-start">
      <Panel>
        <Box flexDirection="column" gap={1}>
          <Text color="white">{message}</Text>
          <Box>
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Box key={option.value} marginRight={2}>
                  <Text dimColor={!isSelected || done} bold={isSelected}>
                    {option.label}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Panel>
    </Box>
  );
}
