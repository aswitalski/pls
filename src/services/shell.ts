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

      // Wrap spawn in try/catch to handle synchronous errors
      let child;
      try {
        child = spawn(cmd.command, {
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

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout.push(text);
        this.outputCallback?.(text, 'stdout');
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
        const commandResult: CommandOutput = {
          description: cmd.description,
          command: cmd.command,
          output: stdout.join(''),
          errors: stderr.join(''),
          result: success ? ExecutionResult.Success : ExecutionResult.Error,
          error: success ? undefined : `Exit code: ${code}`,
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
