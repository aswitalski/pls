import { useState } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus, ConfirmProps } from '../types/components.js';

import { Colors, getTextColor, Palette } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';

import { UserQuery } from './UserQuery.js';

export function Confirm({
  message,
  state,
  status,
  stateHandlers,
  onConfirmed,
  onCancelled,
}: ConfirmProps) {
  const isActive = status === ComponentStatus.Active;
  const [selectedIndex, setSelectedIndex] = useState(state?.selectedIndex ?? 0); // 0 = Yes, 1 = No

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        // Escape: highlight "No" and cancel
        setSelectedIndex(1);
        stateHandlers?.updateState({ selectedIndex: 1 });
        onCancelled();
      } else if (key.tab) {
        // Toggle between Yes (0) and No (1)
        const newIndex = selectedIndex === 0 ? 1 : 0;
        setSelectedIndex(newIndex);
        stateHandlers?.updateState({ selectedIndex: newIndex });
      } else if (key.return) {
        // Confirm selection
        stateHandlers?.updateState({ selectedIndex, confirmed: true });
        if (selectedIndex === 0) {
          onConfirmed();
        } else {
          onCancelled();
        }
      }
    },
    { isActive }
  );

  const options = [
    { label: 'yes', value: 'yes', color: Palette.BrightGreen },
    { label: 'no', value: 'no', color: Colors.Status.Error },
  ];

  if (!isActive) {
    // When done, show both the message and user's choice in timeline
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} marginLeft={1}>
          <Text color={undefined}>{message}</Text>
        </Box>
        <UserQuery>&gt; {options[selectedIndex].label}</UserQuery>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} marginLeft={1}>
        <Text color={getTextColor(isActive)}>{message}</Text>
      </Box>
      <Box marginLeft={1}>
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
