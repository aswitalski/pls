import { Box } from 'ink';

import { ExecuteCommand } from '../../services/anthropic.js';
import { ExecutionStatus } from '../../services/shell.js';
import { TaskOutput } from '../../types/components.js';

import { Output } from './Output.js';
import { SubtaskView } from './Subtask.js';

export interface TaskViewProps {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  elapsed?: number;
  output: TaskOutput | null;
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
  output,
  isFinished,
}: TaskViewProps) {
  const stdout = output?.stdout ?? '';
  const stderr = output?.stderr ?? '';

  return (
    <Box flexDirection="column">
      <SubtaskView
        label={label}
        command={command}
        status={status}
        elapsed={elapsed}
      />
      <Output
        key={`${stdout.length}-${stderr.length}`}
        stdout={stdout}
        stderr={stderr}
        isFinished={isFinished}
        status={status}
      />
    </Box>
  );
}
