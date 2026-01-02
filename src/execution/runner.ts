import { ExecuteCommand } from '../services/anthropic.js';
import {
  CommandOutput,
  ExecutionResult,
  ExecutionStatus,
  executeCommand,
  setOutputCallback,
} from '../services/shell.js';
import { calculateElapsed } from '../services/utils.js';

// Maximum number of output lines to keep in memory
const MAX_OUTPUT_LINES = 128;

/**
 * Limit output to last MAX_OUTPUT_LINES lines to prevent memory exhaustion
 */
function limitLines(output: string): string {
  const lines = output.split('\n');
  return lines.slice(-MAX_OUTPUT_LINES).join('\n');
}

/**
 * Output collected during task execution
 */
export interface ExecutionOutput {
  stdout: string;
  stderr: string;
  error: string;
  workdir?: string;
}

/**
 * Callbacks for task execution events
 */
export interface TaskExecutionCallbacks {
  onUpdate: (output: ExecutionOutput) => void;
  onComplete: (elapsed: number, output: ExecutionOutput) => void;
  onError: (error: string, output: ExecutionOutput) => void;
}

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
  status: ExecutionStatus;
  elapsed: number;
  output: ExecutionOutput;
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
  const createOutput = (): ExecutionOutput => ({
    stdout,
    stderr,
    error,
    workdir,
  });

  // Throttle updates to avoid excessive re-renders (100ms minimum interval)
  let lastUpdateTime = 0;
  let pendingTimeout: ReturnType<typeof setTimeout> | undefined;

  const throttledUpdate = () => {
    const now = Date.now();
    if (now - lastUpdateTime >= 100) {
      lastUpdateTime = now;
      callbacks.onUpdate(createOutput());
    } else if (!pendingTimeout) {
      pendingTimeout = setTimeout(
        () => {
          pendingTimeout = undefined;
          lastUpdateTime = Date.now();
          callbacks.onUpdate(createOutput());
        },
        100 - (now - lastUpdateTime)
      );
    }
  };

  // Set up output streaming callback
  setOutputCallback((data, stream) => {
    if (stream === 'stdout') {
      stdout = limitLines(stdout + data);
    } else {
      stderr = limitLines(stderr + data);
    }
    throttledUpdate();
  });

  try {
    const result: CommandOutput = await executeCommand(
      command,
      undefined,
      index
    );

    // Clear callback and pending timeout
    setOutputCallback(undefined);
    clearTimeout(pendingTimeout);

    const elapsed = calculateElapsed(startTime);

    // Update final output from result
    stdout = result.output;
    stderr = result.errors;
    workdir = result.workdir;

    if (result.result === ExecutionResult.Success) {
      const output = createOutput();
      callbacks.onUpdate(output);
      callbacks.onComplete(elapsed, output);
      return { status: ExecutionStatus.Success, elapsed, output };
    } else {
      const errorMsg = result.errors || result.error || 'Command failed';
      error = errorMsg;
      const output = createOutput();
      callbacks.onUpdate(output);
      callbacks.onError(errorMsg, output);
      return { status: ExecutionStatus.Failed, elapsed, output };
    }
  } catch (err) {
    // Clear callback and pending timeout
    setOutputCallback(undefined);
    clearTimeout(pendingTimeout);

    const elapsed = calculateElapsed(startTime);
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    error = errorMsg;
    const output = createOutput();
    callbacks.onUpdate(output);
    callbacks.onError(errorMsg, output);
    return { status: ExecutionStatus.Failed, elapsed, output };
  }
}

/**
 * Create an empty execution output
 */
export function createEmptyOutput(): ExecutionOutput {
  return { stdout: '', stderr: '', error: '' };
}
