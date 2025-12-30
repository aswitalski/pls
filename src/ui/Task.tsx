import { Box } from 'ink';

import { ExecuteCommand } from '../services/anthropic.js';
import { ExecutionStatus } from '../services/shell.js';

import { Output } from './Output.js';
import { SubtaskView } from './Subtask.js';

export interface TaskViewProps {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  elapsed?: number;
  stdout: string;
  stderr: string;
  isFinished: boolean;
}

/**
 * Pure display component for a task.
 * Combines SubtaskView (label/command/status) with Output (stdout/stderr).
 */
export function TaskView({
  label,
  command,
  status,
  elapsed,
  stdout,
  stderr,
  isFinished,
}: TaskViewProps) {
  return (
    <Box flexDirection="column">
      <SubtaskView
        label={label}
        command={command}
        status={status}
        elapsed={elapsed}
      />
      <Output
        stdout={stdout}
        stderr={stderr}
        isFinished={isFinished}
        status={status}
      />
    </Box>
  );
}
