import { spawn } from 'child_process';

import { ExecuteCommand } from './anthropic.js';

export enum ExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Aborted = 'aborted',
  Cancelled = 'cancelled',
}

export enum ExecutionResult {
  Success = 'success',
  Error = 'error',
  Aborted = 'aborted',
}

export interface CommandOutput {
  description: string;
  command: string;
  output: string[];
  errors: string[];
  result: ExecutionResult;
  error?: string;
  workdir?: string;
}

export interface ExecutionProgress {
  currentIndex: number;
  total: number;
  command: ExecuteCommand;
  status: ExecutionStatus;
  output?: CommandOutput;
}

/**
 * Interface for command execution
 */
export interface Executor {
  execute(
    cmd: ExecuteCommand,
    onProgress?: (status: ExecutionStatus) => void,
    index?: number
  ): Promise<CommandOutput>;
}

const DEFAULT_DELAY_GENERATOR = (index: number) =>
  (Math.pow(3, index + 1) * Math.max(Math.random(), Math.random()) + 1) * 1000;

/**
 * Dummy executor that simulates command execution with configurable delays.
 * Supports mocked responses for testing different scenarios.
 */
export class DummyExecutor implements Executor {
  private mockedResponses: Map<string, Partial<CommandOutput>> = new Map();
  private delayGenerator: (index: number) => number;

  constructor(
    delayGenerator: (index: number) => number = DEFAULT_DELAY_GENERATOR
  ) {
    this.delayGenerator = delayGenerator;
  }

  /**
   * Set a mocked response for a specific command
   */
  mock(command: string, response: Partial<CommandOutput>): void {
    this.mockedResponses.set(command, response);
  }

  /**
   * Clear all mocked responses
   */
  clearMocks(): void {
    this.mockedResponses.clear();
  }

  execute(
    cmd: ExecuteCommand,
    onProgress?: (status: ExecutionStatus) => void,
    index: number = 0
  ): Promise<CommandOutput> {
    return new Promise((resolve) => {
      onProgress?.(ExecutionStatus.Running);

      const delay = this.delayGenerator(index);
      setTimeout(() => {
        const mocked = this.mockedResponses.get(cmd.command);

        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output: mocked?.output ?? [],
          errors: mocked?.errors ?? [],
          result: mocked?.result ?? ExecutionResult.Success,
          error: mocked?.error,
        };

        onProgress?.(
          commandResult.result === ExecutionResult.Success
            ? ExecutionStatus.Success
            : ExecutionStatus.Failed
        );
        resolve(commandResult);
      }, delay);
    });
  }
}

/**
 * Callback for receiving command output streams
 */
export type OutputCallback = (
  data: string,
  stream: 'stdout' | 'stderr'
) => void;

// Marker for extracting pwd from command output
const PWD_MARKER = '__PWD_MARKER_7x9k2m__';
const MAX_OUTPUT_LINES = 128;

/**
 * Lazy line buffer that defers processing until read.
 * Accumulates chunks with O(1) push, processes only when getLines() called.
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
   * Process and trim to maxLines. Called on memory threshold or before read.
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
   * Get all lines as a new array instance.
   * Processes chunks on first call, returns cached result on subsequent calls.
   */
  getLines(): string[] {
    if (this.cachedLines) return [...this.cachedLines];
    if (this.chunks.length === 0) return [];

    const combined = this.chunks.join('');
    const lines = combined.split('\n');

    // Include incomplete last line if non-empty
    const result = lines[lines.length - 1] ? lines : lines.slice(0, -1);

    this.cachedLines =
      result.length > this.maxLines ? result.slice(-this.maxLines) : result;
    return [...this.cachedLines];
  }
}

/**
 * Manages streaming output while filtering out the PWD marker.
 * Uses line-based storage for memory efficiency. The marker and
 * workdir are filtered during streaming, never stored in output.
 */
class OutputStreamer {
  private output = new LazyLineBuffer();
  private pending = '';
  private workdir?: string;
  private markerFound = false;
  private callback?: OutputCallback;

  constructor(callback?: OutputCallback) {
    this.callback = callback;
  }

  /**
   * Add new stdout data. Filters out the PWD marker and extracts
   * workdir during streaming. Only clean output is stored.
   */
  pushStdout(data: string): void {
    // Once marker found, capture workdir and ignore rest
    if (this.markerFound) {
      if (!this.workdir) {
        const line = data.trim().split('\n')[0];
        if (line) this.workdir = line;
      }
      return;
    }

    // Accumulate with pending data
    const combined = this.pending + data;
    const markerIndex = combined.indexOf(PWD_MARKER);

    if (markerIndex !== -1) {
      // Marker found - store and emit only the part before it
      this.markerFound = true;
      const clean = combined.slice(0, markerIndex).trimEnd();
      if (clean) {
        this.output.push(clean);
        this.callback?.(clean, 'stdout');
      }
      // Check if workdir is in the same chunk
      const afterMarker = combined
        .slice(markerIndex + PWD_MARKER.length)
        .trim();
      const line = afterMarker.split('\n')[0];
      if (line) this.workdir = line;
      this.pending = '';
    } else {
      // No marker - store/emit safe portion, keep tail as pending
      const bufferSize = PWD_MARKER.length + 5;
      if (combined.length > bufferSize) {
        const safe = combined.slice(0, -bufferSize);
        this.output.push(safe);
        this.callback?.(safe, 'stdout');
        this.pending = combined.slice(-bufferSize);
      } else {
        this.pending = combined;
      }
    }
  }

  /**
   * Get the final result with cleaned output and workdir.
   */
  getResult(): { output: string[]; workdir?: string } {
    // Flush any remaining pending content (if marker never appeared)
    if (!this.markerFound && this.pending) {
      this.output.push(this.pending);
    }
    return { output: this.output.getLines(), workdir: this.workdir };
  }
}

/**
 * Real executor that spawns shell processes and captures output.
 */
export class RealExecutor implements Executor {
  private outputCallback?: OutputCallback;

  constructor(outputCallback?: OutputCallback) {
    this.outputCallback = outputCallback;
  }

  /**
   * Set or update the output callback
   */
  setOutputCallback(callback: OutputCallback | undefined): void {
    this.outputCallback = callback;
  }

  execute(
    cmd: ExecuteCommand,
    onProgress?: (status: ExecutionStatus) => void,
    _: number = 0
  ): Promise<CommandOutput> {
    return new Promise((resolve) => {
      onProgress?.(ExecutionStatus.Running);

      const stderr = new LazyLineBuffer();

      // Wrap command to capture final working directory
      const wrappedCommand = `${cmd.command}; __exit=$?; echo ""; echo "${PWD_MARKER}"; pwd; exit $__exit`;

      // Wrap spawn in try/catch to handle synchronous errors
      let child;
      try {
        child = spawn(wrappedCommand, {
          shell: true,
          cwd: cmd.workdir || process.cwd(),
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to spawn process';
        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output: [],
          errors: [errorMessage],
          result: ExecutionResult.Error,
          error: errorMessage,
        };
        onProgress?.(ExecutionStatus.Failed);
        resolve(commandResult);
        return;
      }

      // Handle timeout if specified
      const SIGKILL_GRACE_PERIOD = 3000;
      let timeoutId: NodeJS.Timeout | undefined;
      let killTimeoutId: NodeJS.Timeout | undefined;

      if (cmd.timeout && cmd.timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          // Escalate to SIGKILL if process doesn't terminate
          killTimeoutId = setTimeout(() => {
            child.kill('SIGKILL');
          }, SIGKILL_GRACE_PERIOD);
        }, cmd.timeout);
      }

      // Use OutputStreamer for buffered stdout streaming
      const stdoutStreamer = new OutputStreamer(this.outputCallback);

      child.stdout.on('data', (data: Buffer) => {
        stdoutStreamer.pushStdout(data.toString());
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr.push(text);
        this.outputCallback?.(text, 'stderr');
      });

      child.on('error', (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (killTimeoutId) clearTimeout(killTimeoutId);

        const { output } = stdoutStreamer.getResult();
        const stderrLines = stderr.getLines();
        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output,
          errors: stderrLines.length > 0 ? stderrLines : [error.message],
          result: ExecutionResult.Error,
          error: error.message,
        };

        onProgress?.(ExecutionStatus.Failed);
        resolve(commandResult);
      });

      child.on('close', (code: number | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (killTimeoutId) clearTimeout(killTimeoutId);

        const success = code === 0;
        const { output, workdir } = stdoutStreamer.getResult();

        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output,
          errors: stderr.getLines(),
          result: success ? ExecutionResult.Success : ExecutionResult.Error,
          error: success ? undefined : `Exit code: ${code}`,
          workdir,
        };

        onProgress?.(
          success ? ExecutionStatus.Success : ExecutionStatus.Failed
        );
        resolve(commandResult);
      });
    });
  }
}

// Create real executor instance
const realExecutor = new RealExecutor();

// Default executor for production use
const executor: Executor = realExecutor;

/**
 * Set a callback to receive command output in real-time
 */
export function setOutputCallback(callback: OutputCallback | undefined): void {
  realExecutor.setOutputCallback(callback);
}

/**
 * Execute a single shell command
 */
export function executeCommand(
  cmd: ExecuteCommand,
  onProgress?: (status: ExecutionStatus) => void,
  index: number = 0
): Promise<CommandOutput> {
  return executor.execute(cmd, onProgress, index);
}

/**
 * Execute multiple commands sequentially
 */
export async function executeCommands(
  commands: ExecuteCommand[],
  onProgress?: (progress: ExecutionProgress) => void
): Promise<CommandOutput[]> {
  const results: CommandOutput[] = [];

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    onProgress?.({
      currentIndex: i,
      total: commands.length,
      command: cmd,
      status: ExecutionStatus.Running,
    });

    const output = await executeCommand(
      cmd,
      (status) => {
        onProgress?.({
          currentIndex: i,
          total: commands.length,
          command: cmd,
          status,
          output: status !== ExecutionStatus.Running ? results[i] : undefined,
        });
      },
      i
    );

    results.push(output);

    // Update with final status
    onProgress?.({
      currentIndex: i,
      total: commands.length,
      command: cmd,
      status:
        output.result === ExecutionResult.Success
          ? ExecutionStatus.Success
          : ExecutionStatus.Failed,
      output,
    });

    // Stop on failure
    if (output.result !== ExecutionResult.Success) {
      break;
    }
  }

  return results;
}
