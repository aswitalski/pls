import { Box, Text } from 'ink';

import { ExecuteCommand } from '../services/anthropic.js';
import { getStatusColors, Palette, STATUS_ICONS } from '../services/colors.js';
import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import { Spinner } from './Spinner.js';

export interface SubtaskViewProps {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  elapsed?: number;
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
}: SubtaskViewProps) {
  const colors = getStatusColors(status);
  const isCancelled = status === ExecutionStatus.Cancelled;
  const isAborted = status === ExecutionStatus.Aborted;
  const shouldStrikethrough = isCancelled || isAborted;
  const isFinished =
    status === ExecutionStatus.Success ||
    status === ExecutionStatus.Failed ||
    status === ExecutionStatus.Aborted;

  // Apply strikethrough for cancelled and aborted tasks
  const formatText = (text: string) =>
    shouldStrikethrough ? text.split('').join('\u0336') + '\u0336' : text;

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2} gap={1}>
        <Text color={colors.icon}>{STATUS_ICONS[status]}</Text>
        <Text color={colors.description}>
          {shouldStrikethrough
            ? formatText(label || command.description)
            : label || command.description}
        </Text>
        {(isFinished || status === ExecutionStatus.Running) &&
          elapsed !== undefined && (
            <Text color={Palette.DarkGray}>({formatDuration(elapsed)})</Text>
          )}
      </Box>
      <Box paddingLeft={5} flexDirection="row">
        <Box>
          <Text color={colors.symbol}>∟ </Text>
        </Box>
        <Box gap={1}>
          <Text color={colors.command}>{command.command}</Text>
          {status === ExecutionStatus.Running && <Spinner />}
        </Box>
      </Box>
    </Box>
  );
}
