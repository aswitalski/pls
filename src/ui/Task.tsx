import { useEffect, useState } from 'react';
import { Box } from 'ink';

import { ExecuteCommand } from '../services/anthropic.js';
import {
  CommandOutput,
  ExecutionStatus,
  executeCommand,
} from '../services/shell.js';

import { Subtask } from './Subtask.js';

export interface CommandState {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  output?: CommandOutput;
  startTime?: number;
  endTime?: number;
  elapsed?: number;
}

export interface TaskProps {
  label: string;
  command: ExecuteCommand;
  isActive: boolean;
  index: number;
  onComplete?: (index: number, output: CommandOutput) => void;
  onAbort?: (index: number) => void;
  onError?: (error: string) => void;
}

export function Task({
  label,
  command,
  isActive,
  index,
  onComplete,
  onAbort,
  onError,
}: TaskProps) {
  const [status, setStatus] = useState<ExecutionStatus>(
    ExecutionStatus.Pending
  );
  const [startTime, setStartTime] = useState<number | undefined>();
  const [endTime, setEndTime] = useState<number | undefined>();
  const [elapsed, setElapsed] = useState<number | undefined>();
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);

  // Update elapsed time while running
  useEffect(() => {
    if (status !== ExecutionStatus.Running || !startTime) return;

    const interval = setInterval(() => {
      setCurrentElapsed((prev) => {
        const next = Date.now() - startTime;
        return next !== prev ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status, startTime]);

  // Execute command when becoming active
  useEffect(() => {
    if (!isActive || status !== ExecutionStatus.Pending) {
      return;
    }

    let mounted = true;

    async function execute() {
      const start = Date.now();
      setStatus(ExecutionStatus.Running);
      setStartTime(start);
      setCurrentElapsed(0);

      try {
        const output = await executeCommand(command, undefined, index);

        if (!mounted) return;

        const end = Date.now();
        const totalElapsed = Math.floor((end - start) / 1000) * 1000;

        setEndTime(end);
        setElapsed(totalElapsed);
        setStatus(
          output.result === 'success'
            ? ExecutionStatus.Success
            : ExecutionStatus.Failed
        );

        if (output.result === 'success') {
          onComplete?.(index, output);
        } else {
          onError?.(output.errors || 'Command failed');
        }
      } catch (err) {
        if (!mounted) return;

        const end = Date.now();
        const totalElapsed = Math.floor((end - start) / 1000) * 1000;

        setEndTime(end);
        setElapsed(totalElapsed);
        setStatus(ExecutionStatus.Failed);
        onError?.(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    execute();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <Box>
      <Subtask
        label={label}
        command={command}
        status={status}
        startTime={startTime}
        endTime={endTime}
        elapsed={status === ExecutionStatus.Running ? currentElapsed : elapsed}
      />
    </Box>
  );
}
