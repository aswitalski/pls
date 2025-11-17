import React from 'react';
import { Box, Text, useInput } from 'ink';

import { Colors } from '../services/colors.js';

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
  const isCurrent = done === false;
  const [selectedIndex, setSelectedIndex] = React.useState(0); // 0 = Yes, 1 = No

  useInput(
    (input, key) => {
      if (done) return;

      if (key.escape) {
        // Escape: highlight "No" and cancel
        setSelectedIndex(1);
        onCancelled?.();
      } else if (key.tab) {
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
    { label: 'Yes', value: 'yes', color: Colors.Action.Execute },
    { label: 'No', value: 'no', color: Colors.Action.Discard },
  ];

  if (done) {
    // When done, show both the message and user's choice in timeline
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color={undefined}>{message}</Text>
        </Box>
        <Box>
          <Text color={Colors.Text.Inactive}>
            &gt; {options[selectedIndex].label}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={isCurrent ? Colors.Text.Active : Colors.Text.Inactive}>
          {message}
        </Text>
      </Box>
      <Box>
        <Text color={Colors.Action.Select}>&gt;</Text>
        <Text> </Text>
        <Box>
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={option.value} marginRight={2}>
                <Text
                  color={isSelected ? option.color : undefined}
                  dimColor={!isSelected}
                  bold={isSelected}
                >
                  {option.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
