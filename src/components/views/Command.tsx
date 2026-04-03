import { Box, Text } from 'ink';

import { CommandState, ComponentStatus } from '../../types/components.js';

import { Colors } from '../../services/colors.js';

import { Spinner } from './Spinner.js';
import { UserQuery } from './UserQuery.js';

/**
 * Command view: Displays command with spinner
 */
export interface CommandViewProps {
  command: string;
  state: CommandState;
  status: ComponentStatus;
}

export const CommandView = ({ command, status }: CommandViewProps) => {
  const isActive = status === ComponentStatus.Active;

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {!isActive ? (
        <UserQuery>&gt; pls {command}</UserQuery>
      ) : (
        <Box marginLeft={1}>
          <Text color={Colors.Text.Active}>&gt; pls {command}</Text>
          <Text> </Text>
          <Spinner />
        </Box>
      )}
    </Box>
  );
};
