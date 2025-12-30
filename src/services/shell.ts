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

// Marker for extracting pwd from command output
const PWD_MARKER = '__PWD_MARKER_7x9k2m__';

/**
 * Parse stdout to extract workdir and clean output.
 * Returns the cleaned output and the extracted workdir.
 */
function parseWorkdir(rawOutput: string): { output: string; workdir?: string } {
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

      const stdout: string[] = [];
      const stderr: string[] = [];

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

      // Track emitted length to avoid duplicate output to callback
      let emittedLength = 0;

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout.push(text);

        if (this.outputCallback) {
          const accumulated = stdout.join('');
          const markerIndex = accumulated.indexOf(PWD_MARKER);

          if (markerIndex !== -1) {
            // Marker found - emit everything before it (trimmed)
            const cleanLength = accumulated
              .slice(0, markerIndex)
              .trimEnd().length;
            if (cleanLength > emittedLength) {
              const newContent = accumulated.slice(emittedLength, cleanLength);
              this.outputCallback(newContent, 'stdout');
              emittedLength = cleanLength;
            }
          } else {
            // No marker yet - emit all but buffer for potential partial marker
            const bufferSize = PWD_MARKER.length + 5;
            const safeLength = Math.max(
              emittedLength,
              accumulated.length - bufferSize
            );
            if (safeLength > emittedLength) {
              this.outputCallback(
                accumulated.slice(emittedLength, safeLength),
                'stdout'
              );
              emittedLength = safeLength;
            }
          }
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr.push(text);
        this.outputCallback?.(text, 'stderr');
      });

      child.on('error', (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (killTimeoutId) clearTimeout(killTimeoutId);

        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output: stdout.join(''),
          errors: error.message,
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
        const { output, workdir } = parseWorkdir(stdout.join(''));
        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output,
          errors: stderr.join(''),
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

    // Stop if critical command failed
    const isCritical = cmd.critical !== false;
    if (output.result !== ExecutionResult.Success && isCritical) {
      break;
    }
  }

  return results;
}
