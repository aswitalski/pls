import { ChildProcess, spawn } from 'child_process';

import {
  killGracefully,
  MemoryLimitExceeded,
  MemoryMonitor,
} from './monitor.js';

export interface ExecuteCommand {
  description: string;
  command: string;
  workdir?: string;
  timeout?: number;
  memoryLimit?: number;
}

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
  output: string;
  errors: string;
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
          output: mocked?.output ?? '',
          errors: mocked?.errors ?? '',
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

/**
 * Callback for receiving memory updates during execution
 */
export type MemoryCallback = (memoryMB: number) => void;

// Marker for extracting pwd from command output
export const PWD_MARKER = '__PWD_MARKER_7x9k2m__';
export const MAX_OUTPUT_LINES = 128;

/**
 * Limit output to last MAX_OUTPUT_LINES lines.
 */
export function limitLines(output: string): string {
  const lines = output.split('\n');
  return lines.slice(-MAX_OUTPUT_LINES).join('\n');
}

/**
 * Parse stdout to extract workdir and clean output.
 * Returns the cleaned output and the extracted workdir.
 */
export function parseWorkdir(rawOutput: string): {
  output: string;
  workdir?: string;
} {
  const markerIndex = rawOutput.lastIndexOf(PWD_MARKER);
  if (markerIndex === -1) {
    return { output: rawOutput };
  }

  const output = rawOutput.slice(0, markerIndex).trimEnd();
  const pwdPart = rawOutput.slice(markerIndex + PWD_MARKER.length).trim();
  const lines = pwdPart.split('\n').filter((l) => l.trim());
  const workdir = lines[0];

  return { output, workdir };
}

/**
 * Manages streaming output while filtering out the PWD marker.
 * Buffers output to avoid emitting partial markers to the callback.
 */
export class OutputStreamer {
  private chunks: string[] = [];
  private emittedLength = 0;
  private callback?: OutputCallback;

  constructor(callback?: OutputCallback) {
    this.callback = callback;
  }

  /**
   * Add new stdout data and emit safe content to callback.
   * Buffers data to avoid emitting partial PWD markers.
   */
  pushStdout(data: string): void {
    this.chunks.push(data);

    // Collapse when we have too many chunks to prevent memory growth
    if (this.chunks.length > 16) {
      const accumulated = this.chunks.join('');
      const limited = limitLines(accumulated);
      this.chunks = [limited];
      // Mark all collapsed content as emitted to prevent re-emission
      this.emittedLength = limited.length;
    }

    if (!this.callback) return;

    const accumulated = this.chunks.join('');
    const markerIndex = accumulated.indexOf(PWD_MARKER);

    if (markerIndex !== -1) {
      // Marker found - emit everything before it (trimmed)
      this.emitUpTo(accumulated.slice(0, markerIndex).trimEnd().length);
    } else {
      // No marker yet - emit all but buffer for potential partial marker
      const bufferSize = PWD_MARKER.length + 5;
      const safeLength = Math.max(
        this.emittedLength,
        accumulated.length - bufferSize
      );
      this.emitUpTo(safeLength);
    }
  }

  /**
   * Emit content up to the specified length if there's new content.
   */
  private emitUpTo(length: number): void {
    if (length > this.emittedLength && this.callback) {
      const accumulated = this.chunks.join('');
      const newContent = accumulated.slice(this.emittedLength, length);
      this.callback(newContent, 'stdout');
      this.emittedLength = length;
    }
  }

  /**
   * Get the accumulated raw output.
   */
  getAccumulated(): string {
    return limitLines(this.chunks.join(''));
  }
}

/**
 * Real executor that spawns shell processes and captures output.
 */
export class RealExecutor implements Executor {
  private outputCallback?: OutputCallback;
  private memoryCallback?: MemoryCallback;
  private currentChild?: ChildProcess;
  private cancelKillTimeoutId?: NodeJS.Timeout;

  constructor(outputCallback?: OutputCallback) {
    this.outputCallback = outputCallback;
  }

  /**
   * Kill the currently running child process gracefully
   */
  killCurrentProcess(): void {
    if (this.currentChild) {
      this.cancelKillTimeoutId = killGracefully(this.currentChild);
    }
  }

  /**
   * Write data to the stdin of the currently running child process
   */
  writeStdin(data: string): void {
    if (this.currentChild?.stdin?.writable) {
      this.currentChild.stdin.write(data);
    }
  }

  /**
   * Set or update the output callback
   */
  setOutputCallback(callback: OutputCallback | undefined): void {
    this.outputCallback = callback;
  }

  /**
   * Set or update the memory callback
   */
  setMemoryCallback(callback: MemoryCallback | undefined): void {
    this.memoryCallback = callback;
  }

  execute(
    cmd: ExecuteCommand,
    onProgress?: (status: ExecutionStatus) => void,
    _: number = 0
  ): Promise<CommandOutput> {
    return new Promise((resolve) => {
      onProgress?.(ExecutionStatus.Running);

      const stderr: string[] = [];

      // Wrap command to capture final working directory
      const wrappedCommand = `${cmd.command}; __exit=$?; echo ""; echo "${PWD_MARKER}"; pwd; exit $__exit`;

      // Wrap spawn in try/catch to handle synchronous errors
      let child;
      try {
        child = spawn(wrappedCommand, {
          shell: true,
          cwd: cmd.workdir || process.cwd(),
          detached: true,
        });
        this.currentChild = child;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to spawn process';
        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output: '',
          errors: errorMessage,
          result: ExecutionResult.Error,
          error: errorMessage,
        };
        onProgress?.(ExecutionStatus.Failed);
        resolve(commandResult);
        return;
      }

      // Handle timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      let killTimeoutId: NodeJS.Timeout | undefined;

      if (cmd.timeout && cmd.timeout > 0) {
        timeoutId = setTimeout(() => {
          killTimeoutId = killGracefully(child);
        }, cmd.timeout);
      }

      // Handle memory limit monitoring
      let memoryMonitor: MemoryMonitor | undefined;
      let memoryInfo: MemoryLimitExceeded | undefined;

      if (cmd.memoryLimit) {
        memoryMonitor = new MemoryMonitor(
          child,
          cmd.memoryLimit,
          (info) => {
            memoryInfo = info;
          },
          undefined,
          this.memoryCallback
        );
        memoryMonitor.start();
      }

      // Use OutputStreamer for buffered stdout streaming
      const stdoutStreamer = new OutputStreamer(this.outputCallback);

      child.stdout.on('data', (data: Buffer) => {
        stdoutStreamer.pushStdout(data.toString());
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr.push(text);

        // Collapse when we have too many chunks to prevent memory growth
        if (stderr.length > 16) {
          const accumulated = stderr.join('');
          const limited = limitLines(accumulated);
          stderr.length = 0;
          stderr.push(limited);
        }

        this.outputCallback?.(text, 'stderr');
      });

      const cleanup = () => {
        this.currentChild = undefined;
        if (timeoutId) clearTimeout(timeoutId);
        if (killTimeoutId) clearTimeout(killTimeoutId);
        if (this.cancelKillTimeoutId) {
          clearTimeout(this.cancelKillTimeoutId);
          this.cancelKillTimeoutId = undefined;
        }
        memoryMonitor?.stop();
      };

      child.on('error', (error: Error) => {
        cleanup();

        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output: stdoutStreamer.getAccumulated(),
          errors: limitLines(stderr.join('')) || error.message,
          result: ExecutionResult.Error,
          error: error.message,
        };

        onProgress?.(ExecutionStatus.Failed);
        resolve(commandResult);
      });

      child.on('exit', (code: number | null) => {
        cleanup();

        const { output, workdir } = parseWorkdir(
          stdoutStreamer.getAccumulated()
        );

        // Check if terminated due to memory limit
        const killedByMemoryLimit = memoryMonitor?.wasKilledByMemoryLimit();
        const success = code === 0 && !killedByMemoryLimit;

        let errorMessage: string | undefined;
        if (killedByMemoryLimit && memoryInfo) {
          errorMessage =
            `Process exceeded ${memoryInfo.limit} MB memory limit, ` +
            `${memoryInfo.used} MB was used.`;
        } else if (!success) {
          errorMessage = `Exit code: ${code}`;
        }

        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output,
          errors: limitLines(stderr.join('')),
          result: success ? ExecutionResult.Success : ExecutionResult.Error,
          error: errorMessage,
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
 * Kill the currently running command process
 */
export function killCurrentProcess(): void {
  realExecutor.killCurrentProcess();
}

/**
 * Write data to the stdin of the currently running command
 */
export function writeStdin(data: string): void {
  realExecutor.writeStdin(data);
}

/**
 * Set a callback to receive command output in real-time
 */
export function setOutputCallback(callback: OutputCallback | undefined): void {
  realExecutor.setOutputCallback(callback);
}

/**
 * Set a callback to receive memory updates during execution
 */
export function setMemoryCallback(callback: MemoryCallback | undefined): void {
  realExecutor.setMemoryCallback(callback);
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
