import { Box, Text } from 'ink';

import { loadDebugSetting } from '../../configuration/io.js';
import { DebugLevel } from '../../configuration/types.js';
import {
  getStatusColors,
  Palette,
  STATUS_ICONS,
} from '../../services/colors.js';
import { ExecuteCommand, ExecutionStatus } from '../../services/shell.js';
import { formatDuration, formatMemory } from '../../services/utils.js';

import { Spinner } from './Spinner.js';

export interface SubtaskViewProps {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  elapsed?: number;
  currentMemory?: number;
}

/**
 * Pure display component for a single subtask.
 * Shows label, command, status icon, and elapsed time.
 */
export function SubtaskView({
  label,
  command,
  status,
  elapsed,
  currentMemory,
}: SubtaskViewProps) {
  const colors = getStatusColors(status);
  const debugLevel = loadDebugSetting();
  const isVerbose = debugLevel === DebugLevel.Verbose;

  const isCancelled = status === ExecutionStatus.Cancelled;
  const isAborted = status === ExecutionStatus.Aborted;
  const isRunning = status === ExecutionStatus.Running;
  const isFinished =
    status === ExecutionStatus.Success ||
    status === ExecutionStatus.Failed ||
    status === ExecutionStatus.Aborted;

  // Apply strikethrough for cancelled and aborted tasks
  const shouldStrikethrough = isCancelled || isAborted;

  // Show memory in verbose mode while running
  const showMemory = isVerbose && isRunning && currentMemory !== undefined;

  // Build time/memory display
  const showTimeInfo = (isFinished || isRunning) && elapsed !== undefined;

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2} gap={1}>
        <Text color={colors.icon}>{STATUS_ICONS[status]}</Text>
        <Text color={colors.description} strikethrough={shouldStrikethrough}>
          {label || command.description}
        </Text>
        {showTimeInfo && (
          <Text color={Palette.DarkGray}>({formatDuration(elapsed)})</Text>
        )}
        {showMemory && (
          <Text color={Palette.Yellow}>{formatMemory(currentMemory)}</Text>
        )}
      </Box>
      <Box paddingLeft={5} flexDirection="row">
        <Box>
          <Text color={colors.symbol}>∟ </Text>
        </Box>
        <Box gap={1}>
          <Text color={colors.command}>{command.command}</Text>
          {isRunning && <Spinner />}
        </Box>
      </Box>
    </Box>
  );
}
