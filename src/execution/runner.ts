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
 * Lazy line buffer that defers processing until read.
 * Accumulates chunks with O(1) push, processes only when getLastLines() called.
 * Caches result until invalidated by new data.
 * Compacts at 1MB to bound memory for high-volume output.
 */
class LazyLineBuffer {
  private chunks: string[] = [];
  private totalBytes = 0;
  private cachedLines: string[] | null = null;
  private readonly maxLines: number;

  constructor(maxLines = MAX_OUTPUT_LINES) {
    this.maxLines = maxLines;
  }

  /**
   * Add new data. O(1) array push, no string processing.
   */
  push(data: string): void {
    this.chunks.push(data);
    this.totalBytes += data.length;
    this.cachedLines = null;

    // Safety valve - compact if memory gets extreme
    if (this.totalBytes > 1024 * 1024) {
      this.compact();
    }
  }

  /**
   * Process and trim to maxLines. Called on memory threshold.
   */
  private compact(): void {
    if (this.chunks.length === 0) return;

    const combined = this.chunks.join('');
    const lines = combined.split('\n');
    const incomplete = lines[lines.length - 1];
    const complete = lines.slice(0, -1);

    if (complete.length > this.maxLines) {
      const kept = complete.slice(-this.maxLines);
      this.chunks = incomplete
        ? [kept.join('\n') + '\n' + incomplete]
        : [kept.join('\n')];
    } else {
      this.chunks = [combined];
    }
    this.totalBytes = this.chunks[0].length;
    this.cachedLines = null;
  }

  /**
   * Get the last N lines as a new array instance.
   * Processes chunks on first call, returns cached result on subsequent calls.
   */
  getLastLines(n: number): string[] {
    if (!this.cachedLines) {
      if (this.chunks.length === 0) {
        this.cachedLines = [];
      } else {
        const combined = this.chunks.join('');
        const lines = combined.split('\n');
        // Include incomplete last line if non-empty
        const result = lines[lines.length - 1] ? lines : lines.slice(0, -1);
        this.cachedLines =
          result.length > this.maxLines ? result.slice(-this.maxLines) : result;
      }
    }
    return this.cachedLines.slice(-n);
  }
}

// Number of lines to include in output for display
const DISPLAY_LINES = 8;

/**
 * Output collected during task execution.
 * stdout/stderr are arrays of the last N lines for efficient display.
 */
export interface ExecutionOutput {
  stdout: string[];
  stderr: string[];
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
  let error = '';
  let workdir: string | undefined;

  // Create new buffer instances for this task
  const stdoutBuffer = new LazyLineBuffer();
  const stderrBuffer = new LazyLineBuffer();

  // Helper to create current output snapshot (last N lines as new arrays)
  const createOutput = (): ExecutionOutput => ({
    stdout: stdoutBuffer.getLastLines(DISPLAY_LINES),
    stderr: stderrBuffer.getLastLines(DISPLAY_LINES),
    error,
    workdir,
  });

  // Throttle updates to avoid excessive re-renders
  const UPDATE_INTERVAL = 100;
  let lastUpdateTime = 0;
  let pendingUpdate = false;

  const scheduleUpdate = () => {
    if (pendingUpdate) return;
    pendingUpdate = true;

    const now = Date.now();
    const elapsed = now - lastUpdateTime;

    if (elapsed >= UPDATE_INTERVAL) {
      // Enough time passed, update immediately
      lastUpdateTime = now;
      pendingUpdate = false;
      callbacks.onUpdate(createOutput());
    } else {
      // Schedule update for later
      setTimeout(() => {
        lastUpdateTime = Date.now();
        pendingUpdate = false;
        callbacks.onUpdate(createOutput());
      }, UPDATE_INTERVAL - elapsed);
    }
  };

  // Set up output streaming callback
  setOutputCallback((data, stream) => {
    if (stream === 'stdout') {
      stdoutBuffer.push(data);
    } else {
      stderrBuffer.push(data);
    }
    scheduleUpdate();
  });

  try {
    const result: CommandOutput = await executeCommand(
      command,
      undefined,
      index
    );

    // Clear callback
    setOutputCallback(undefined);

    const elapsed = calculateElapsed(startTime);
    workdir = result.workdir;

    // Create final output from result (already arrays from shell.ts)
    const finalOutput = (): ExecutionOutput => ({
      stdout: result.output.slice(-DISPLAY_LINES),
      stderr: result.errors.slice(-DISPLAY_LINES),
      error,
      workdir,
    });

    if (result.result === ExecutionResult.Success) {
      const output = finalOutput();
      callbacks.onComplete(elapsed, output);
      return { status: ExecutionStatus.Success, elapsed, output };
    } else {
      error = result.errors.join('\n') || result.error || 'Command failed';
      const output = finalOutput();
      callbacks.onError(error, output);
      return { status: ExecutionStatus.Failed, elapsed, output };
    }
  } catch (err) {
    // Clear callback
    setOutputCallback(undefined);

    const elapsed = calculateElapsed(startTime);
    error = err instanceof Error ? err.message : 'Unknown error';
    const output = createOutput();
    callbacks.onError(error, output);
    return { status: ExecutionStatus.Failed, elapsed, output };
  }
}

/**
 * Create an empty execution output
 */
export function createEmptyOutput(): ExecutionOutput {
  return { stdout: [], stderr: [], error: '' };
}
