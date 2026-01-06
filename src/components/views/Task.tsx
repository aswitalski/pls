import { Box } from 'ink';

import { loadDebugSetting } from '../../configuration/io.js';
import { DebugLevel } from '../../configuration/types.js';
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
  isActive?: boolean;
}

/**
 * Pure display component for a task.
 * Combines SubtaskView (label/command/status) with Output (stdout/stderr).
 * Output is shown during active execution, or in timeline only with debug mode.
 */
export function TaskView({
  label,
  command,
  status,
  elapsed,
  output,
  isFinished,
  isActive = false,
}: TaskViewProps) {
  const stdout = output?.stdout ?? '';
  const stderr = output?.stderr ?? '';

  // Show output during active execution, or in timeline only with debug enabled
  const showOutput = isActive || loadDebugSetting() !== DebugLevel.None;

  return (
    <Box flexDirection="column">
      <SubtaskView
        label={label}
        command={command}
        status={status}
        elapsed={elapsed}
      />
      {showOutput && (
        <Output
          key={`${stdout.length}-${stderr.length}`}
          stdout={stdout}
          stderr={stderr}
          isFinished={isFinished}
          status={status}
        />
      )}
    </Box>
  );
}
