import { OutputChunk, OutputSource } from '../types/components.js';

import {
  CommandOutput,
  ExecuteCommand,
  ExecutionResult,
  ExecutionStatus,
  executeCommand,
  setMemoryCallback,
  setOutputCallback,
} from '../services/shell.js';
import { calculateElapsed } from '../services/utils.js';

// Maximum number of output chunks to keep in memory
const MAX_OUTPUT_CHUNKS = 256;

export type { OutputChunk };

/**
 * Output collected during task execution
 */
export interface ExecutionOutput {
  chunks: OutputChunk[];
  error: string;
  workdir?: string;
  currentMemory?: number;
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
  let chunks: OutputChunk[] = [];
  let error = '';
  let workdir: string | undefined;
  let currentMemory: number | undefined;

  // Helper to create current output snapshot
  const createOutput = (): ExecutionOutput => ({
    chunks,
    error,
    workdir,
    currentMemory,
  });

  // Throttle updates to avoid excessive re-renders (80ms minimum interval)
  let lastUpdateTime = 0;
  let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
  const THROTTLE_INTERVAL = 80;

  const throttledUpdate = () => {
    const now = Date.now();
    if (now - lastUpdateTime >= THROTTLE_INTERVAL) {
      lastUpdateTime = now;
      callbacks.onUpdate(createOutput());
    } else if (!pendingTimeout) {
      pendingTimeout = setTimeout(
        () => {
          pendingTimeout = undefined;
          lastUpdateTime = Date.now();
          callbacks.onUpdate(createOutput());
        },
        THROTTLE_INTERVAL - (now - lastUpdateTime)
      );
    }
  };

  // Set up output streaming callback - store chunks with timestamps
  setOutputCallback((data, stream) => {
    chunks.push({
      text: data,
      timestamp: Date.now(),
      source: stream === 'stdout' ? OutputSource.Stdout : OutputSource.Stderr,
    });
    // Limit chunks to prevent memory exhaustion
    if (chunks.length > MAX_OUTPUT_CHUNKS) {
      chunks = chunks.slice(-MAX_OUTPUT_CHUNKS);
    }
    throttledUpdate();
  });

  // Set up memory callback to track current memory
  setMemoryCallback((memoryMB) => {
    currentMemory = memoryMB;
    throttledUpdate();
  });

  try {
    const result: CommandOutput = await executeCommand(
      command,
      undefined,
      index
    );

    // Clear callbacks and pending timeout
    setOutputCallback(undefined);
    setMemoryCallback(undefined);
    clearTimeout(pendingTimeout);

    const elapsed = calculateElapsed(startTime);
    const now = Date.now();

    // Update workdir from result
    workdir = result.workdir;

    // Add final output/errors as chunks only if not already captured during streaming
    const hasStreamedStdout = chunks.some(
      (c) => c.source === OutputSource.Stdout
    );
    const hasStreamedStderr = chunks.some(
      (c) => c.source === OutputSource.Stderr
    );

    if (result.output && result.output.trim() && !hasStreamedStdout) {
      chunks.push({
        text: result.output,
        timestamp: now,
        source: OutputSource.Stdout,
      });
    }
    if (result.errors && result.errors.trim() && !hasStreamedStderr) {
      chunks.push({
        text: result.errors,
        timestamp: now + 1,
        source: OutputSource.Stderr,
      });
    }

    if (result.result === ExecutionResult.Success) {
      const output = createOutput();
      callbacks.onUpdate(output);
      callbacks.onComplete(elapsed, output);
      return { status: ExecutionStatus.Success, elapsed, output };
    } else {
      const errorMsg = result.error || result.errors || 'Command failed';
      error = errorMsg;
      const output = createOutput();
      callbacks.onUpdate(output);
      callbacks.onError(errorMsg, output);
      return { status: ExecutionStatus.Failed, elapsed, output };
    }
  } catch (err) {
    // Clear callbacks and pending timeout
    setOutputCallback(undefined);
    setMemoryCallback(undefined);
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
  return { chunks: [], error: '' };
}
