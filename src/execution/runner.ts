import { ExecuteCommand } from '../services/anthropic.js';
import {
  CommandOutput,
  ExecutionResult,
  ExecutionStatus,
  executeCommand,
  setOutputCallback,
} from '../services/shell.js';
import { calculateElapsed } from '../services/utils.js';

/**
 * Output collected during task execution
 */
export interface TaskOutput {
  stdout: string;
  stderr: string;
  error: string;
  workdir?: string;
}

/**
 * Callbacks for task execution events
 */
export interface TaskExecutionCallbacks {
  onStart?: () => void;
  onOutputChange?: (output: TaskOutput) => void;
  onComplete?: (elapsed: number, output: TaskOutput) => void;
  onError?: (error: string, elapsed: number, output: TaskOutput) => void;
}

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
  status: ExecutionStatus;
  elapsed: number;
  output: TaskOutput;
}

/**
 * Execute a single task and track its progress.
 * All execution logic is contained here, outside of React components.
 */
export async function executeTask(
  command: ExecuteCommand,
  index: number,
  callbacks: TaskExecutionCallbacks
): Promise<TaskExecutionResult> {
  const startTime = Date.now();
  let stdout = '';
  let stderr = '';
  let error = '';
  let workdir: string | undefined;

  // Helper to create current output snapshot
  const createOutput = (): TaskOutput => ({
    stdout,
    stderr,
    error,
    workdir,
  });

  // Set up output streaming callback
  setOutputCallback((data, stream) => {
    if (stream === 'stdout') {
      stdout += data;
    } else {
      stderr += data;
    }
    callbacks.onOutputChange?.(createOutput());
  });

  callbacks.onStart?.();

  try {
    const result: CommandOutput = await executeCommand(
      command,
      undefined,
      index
    );

    // Clear callback
    setOutputCallback(undefined);

    const elapsed = calculateElapsed(startTime);

    // Update final output from result
    stdout = result.output;
    stderr = result.errors;
    workdir = result.workdir;

    if (result.result === ExecutionResult.Success) {
      const output = createOutput();
      callbacks.onComplete?.(elapsed, output);
      return {
        status: ExecutionStatus.Success,
        elapsed,
        output,
      };
    } else {
      const errorMsg = result.errors || result.error || 'Command failed';
      error = errorMsg;
      const output = createOutput();
      callbacks.onError?.(errorMsg, elapsed, output);
      return {
        status: ExecutionStatus.Failed,
        elapsed,
        output,
      };
    }
  } catch (err) {
    // Clear callback
    setOutputCallback(undefined);

    const elapsed = calculateElapsed(startTime);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    error = errorMsg;
    const output = createOutput();
    callbacks.onError?.(errorMsg, elapsed, output);
    return {
      status: ExecutionStatus.Failed,
      elapsed,
      output,
    };
  }
}

/**
 * Create an empty task output
 */
export function createEmptyOutput(): TaskOutput {
  return { stdout: '', stderr: '', error: '' };
}
