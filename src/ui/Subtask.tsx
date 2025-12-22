import { Box, Text } from 'ink';

import { ExecuteCommand } from '../services/anthropic.js';
import { getStatusColors, Palette, STATUS_ICONS } from '../services/colors.js';
import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import { Spinner } from './Spinner.js';

export interface SubtaskProps {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  startTime?: number;
  endTime?: number;
  elapsed?: number;
}

export function Subtask({
  label,
  command,
  status,
  startTime,
  endTime,
  elapsed,
}: SubtaskProps) {
  const colors = getStatusColors(status);

  const elapsedTime =
    elapsed ?? (startTime && endTime ? endTime - startTime : undefined);

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2} gap={1}>
        <Text color={colors.icon}>{STATUS_ICONS[status]}</Text>
        <Text color={colors.description}>{label || command.description}</Text>
        {elapsedTime !== undefined && (
          <Text color={Palette.DarkGray}>({formatDuration(elapsedTime)})</Text>
        )}
      </Box>
      <Box paddingLeft={5} gap={1}>
        <Text color={colors.symbol}>∟</Text>
        <Text color={colors.command}>{command.command}</Text>
        {status === ExecutionStatus.Running && <Spinner />}
      </Box>
    </Box>
  );
}
