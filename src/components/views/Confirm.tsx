import { Box, Text } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { Colors, getTextColor, Palette } from '../../services/colors.js';

import { UserQuery } from './UserQuery.js';

const OPTIONS = [
  { label: 'yes', value: 'yes', color: Palette.BrightGreen },
  { label: 'no', value: 'no', color: Colors.Status.Error },
];

/**
 * Props for ConfirmView - display-ready data
 */
export interface ConfirmViewProps {
  status: ComponentStatus;
  message: string;
  selectedIndex: number;
}

/**
 * Confirm view: Displays yes/no confirmation prompt
 */
export const ConfirmView = ({
  status,
  message,
  selectedIndex,
}: ConfirmViewProps) => {
  const isActive = status === ComponentStatus.Active;

  // Timeline rendering (Done status)
  if (status === ComponentStatus.Done) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} marginLeft={1}>
          <Text color={undefined}>{message}</Text>
        </Box>
        <UserQuery>&gt; {OPTIONS[selectedIndex].label}</UserQuery>
      </Box>
    );
  }

  // Active/Pending rendering
  return (
    <Box flexDirection="column">
      <Box marginBottom={1} marginLeft={1}>
        <Text color={getTextColor(isActive)}>{message}</Text>
      </Box>
      <Box marginLeft={1}>
        <Text color={Colors.Action.Select}>&gt;</Text>
        <Text> </Text>
        <Box>
          {OPTIONS.map((option, index) => {
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
};
