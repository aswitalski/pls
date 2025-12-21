import { Box, Text } from 'ink';

import { ExecuteCommand } from '../services/anthropic.js';
import { Colors, getTextColor, Palette } from '../services/colors.js';
import { formatDuration } from '../services/utils.js';
import { ExecutionStatus } from '../services/shell.js';

import { Spinner } from './Spinner.js';

const STATUS_ICONS: Record<ExecutionStatus, string> = {
  [ExecutionStatus.Pending]: '- ',
  [ExecutionStatus.Running]: '• ',
  [ExecutionStatus.Success]: '✓ ',
  [ExecutionStatus.Failed]: '✗ ',
  [ExecutionStatus.Aborted]: '⊘ ',
};

function getStatusColors(status: ExecutionStatus) {
  switch (status) {
    case ExecutionStatus.Pending:
      return {
        icon: Palette.Gray,
        description: Palette.Gray,
        command: Palette.DarkGray,
        symbol: Palette.DarkGray,
      };
    case ExecutionStatus.Running:
      return {
        icon: Palette.Gray,
        description: getTextColor(true),
        command: Palette.LightGreen,
        symbol: Palette.AshGray,
      };
    case ExecutionStatus.Success:
      return {
        icon: Colors.Status.Success,
        description: getTextColor(true),
        command: Palette.Gray,
        symbol: Palette.Gray,
      };
    case ExecutionStatus.Failed:
      return {
        icon: Colors.Status.Error,
        description: Colors.Status.Error,
        command: Colors.Status.Error,
        symbol: Palette.Gray,
      };
    case ExecutionStatus.Aborted:
      return {
        icon: Palette.DarkOrange,
        description: getTextColor(true),
        command: Palette.DarkOrange,
        symbol: Palette.Gray,
      };
  }
}

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

  const getElapsedTime = () => {
    if (status === ExecutionStatus.Running && elapsed !== undefined) {
      return elapsed;
    } else if (startTime && endTime) {
      return endTime - startTime;
    }
    return undefined;
  };

  const elapsedTime = getElapsedTime();

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
