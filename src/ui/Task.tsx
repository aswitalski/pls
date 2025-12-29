import { useEffect, useRef, useState } from 'react';
import { Box } from 'ink';

import { ExecuteCommand } from '../services/anthropic.js';
import {
  CommandOutput,
  ExecutionResult,
  ExecutionStatus,
  executeCommand,
  setOutputCallback,
} from '../services/shell.js';
import { calculateElapsed } from '../services/utils.js';

import { Output } from './Output.js';
import { Subtask } from './Subtask.js';

export interface TaskOutput {
  stdout: string;
  stderr: string;
  error: string;
}

export interface TaskProps {
  label: string;
  command: ExecuteCommand;
  isActive: boolean;
  index: number;
  initialStatus?: ExecutionStatus;
  initialElapsed?: number;
  initialOutput?: TaskOutput;
  onOutputChange?: (index: number, taskOutput: TaskOutput) => void;
  onComplete?: (
    index: number,
    output: CommandOutput,
    elapsed: number,
    taskOutput: TaskOutput
  ) => void;
  onAbort?: (index: number, taskOutput: TaskOutput) => void;
  onError?: (
    index: number,
    error: string,
    elapsed: number,
    taskOutput: TaskOutput
  ) => void;
}

export function Task({
  label,
  command,
  isActive,
  index,
  initialStatus,
  initialElapsed,
  initialOutput,
  onOutputChange,
  onComplete,
  onAbort,
  onError,
}: TaskProps) {
  const [status, setStatus] = useState<ExecutionStatus>(
    initialStatus ?? ExecutionStatus.Pending
  );
  const [startTime, setStartTime] = useState<number | undefined>();
  const [endTime, setEndTime] = useState<number | undefined>();
  const [elapsed, setElapsed] = useState<number | undefined>(initialElapsed);
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);
  const [stdout, setStdout] = useState<string>(initialOutput?.stdout ?? '');
  const [stderr, setStderr] = useState<string>(initialOutput?.stderr ?? '');
  const [error, setError] = useState<string>(initialOutput?.error ?? '');

  // Refs to track current output for callbacks (avoid stale closure)
  const stdoutRef = useRef(stdout);
  const stderrRef = useRef(stderr);
  const errorRef = useRef(error);
  stdoutRef.current = stdout;
  stderrRef.current = stderr;
  errorRef.current = error;

  // Update elapsed time while running
  useEffect(() => {
    if (status !== ExecutionStatus.Running || !startTime) return;

    const interval = setInterval(() => {
      setCurrentElapsed((prev) => {
        const next = Date.now() - startTime;
        return next !== prev ? next : prev;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [status, startTime]);

  // Execute command when becoming active
  useEffect(() => {
    // Don't execute if task is cancelled or if not active
    if (
      !isActive ||
      status === ExecutionStatus.Cancelled ||
      status !== ExecutionStatus.Pending
    ) {
      return;
    }

    let mounted = true;

    async function execute() {
      const start = Date.now();
      setStatus(ExecutionStatus.Running);
      setStartTime(start);
      setCurrentElapsed(0);
      setStdout('');
      setStderr('');
      setError('');

      // Set up output callback to capture real-time output
      setOutputCallback((data, stream) => {
        if (!mounted) return;
        if (stream === 'stdout') {
          setStdout((prev) => {
            const newStdout = prev + data;
            stdoutRef.current = newStdout;
            // Report output change to parent using refs for current values
            onOutputChange?.(index, {
              stdout: newStdout,
              stderr: stderrRef.current,
              error: errorRef.current,
            });
            return newStdout;
          });
        } else {
          setStderr((prev) => {
            const newStderr = prev + data;
            stderrRef.current = newStderr;
            // Report output change to parent using refs for current values
            onOutputChange?.(index, {
              stdout: stdoutRef.current,
              stderr: newStderr,
              error: errorRef.current,
            });
            return newStderr;
          });
        }
      });

      try {
        const output = await executeCommand(command, undefined, index);
        setOutputCallback(undefined); // Clear callback

        if (!mounted) return;

        const end = Date.now();
        setEndTime(end);
        const taskDuration = calculateElapsed(start);
        setElapsed(taskDuration);
        setStatus(
          output.result === ExecutionResult.Success
            ? ExecutionStatus.Success
            : ExecutionStatus.Failed
        );

        if (output.result === ExecutionResult.Success) {
          const taskOutput = {
            stdout: output.output,
            stderr: output.errors,
            error: '',
          };
          onComplete?.(index, output, taskDuration, taskOutput);
        } else {
          const errorMsg = output.errors || output.error || 'Command failed';
          setError(errorMsg);
          const taskOutput = {
            stdout: output.output,
            stderr: output.errors,
            error: errorMsg,
          };
          onError?.(index, errorMsg, taskDuration, taskOutput);
        }
      } catch (err) {
        setOutputCallback(undefined); // Clear callback
        if (!mounted) return;

        const end = Date.now();
        setEndTime(end);
        const errorDuration = calculateElapsed(start);
        setElapsed(errorDuration);
        setStatus(ExecutionStatus.Failed);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        const taskOutput = {
          stdout: stdoutRef.current,
          stderr: stderrRef.current,
          error: errorMsg,
        };
        // Use try/catch to prevent callback errors from propagating
        try {
          onError?.(index, errorMsg, errorDuration, taskOutput);
        } catch {
          // Callback error - already set error state above
        }
      }
    }

    void execute();

    return () => {
      mounted = false;
    };
  }, [isActive]);

  // Handle abort when task becomes inactive while running
  useEffect(() => {
    if (!isActive && status === ExecutionStatus.Running && startTime) {
      // Task was aborted mid-execution
      const end = Date.now();
      setEndTime(end);
      setElapsed(calculateElapsed(startTime));
      setStatus(ExecutionStatus.Aborted);
      const taskOutput = { stdout, stderr, error };
      onAbort?.(index, taskOutput);
    }
  }, [isActive, status, startTime, index, onAbort, stdout, stderr, error]);

  return (
    <Box flexDirection="column">
      <Subtask
        label={label}
        command={command}
        status={status}
        isActive={isActive}
        startTime={startTime}
        endTime={endTime}
        elapsed={status === ExecutionStatus.Running ? currentElapsed : elapsed}
      />
      <Output
        key={`${stdout.length}-${stderr.length}`}
        stdout={stdout}
        stderr={stderr}
        failed={status === ExecutionStatus.Failed}
      />
    </Box>
  );
}
