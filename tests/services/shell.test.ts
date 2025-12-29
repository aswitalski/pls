import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CommandOutput,
  DummyExecutor,
  ExecutionProgress,
  ExecutionResult,
  ExecutionStatus,
  RealExecutor,
} from '../../src/services/shell.js';
import { ExecuteCommand } from '../../src/services/anthropic.js';

// Test executor with small delays (0-20ms)
const testExecutor = new DummyExecutor(() => Math.random() * 20);

describe('Shell service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // Helper to execute a single command using test executor
  function executeCommand(
    cmd: ExecuteCommand,
    onProgress?: (status: ExecutionStatus) => void,
    index: number = 0
  ) {
    return testExecutor.execute(cmd, onProgress, index);
  }

  // Helper to execute multiple commands using test executor
  async function executeCommands(
    commands: ExecuteCommand[],
    onProgress?: (progress: ExecutionProgress) => void
  ) {
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

  describe('Execute single command', () => {
    it('returns successful output after execution', async () => {
      const cmd: ExecuteCommand = {
        description: 'Create directory',
        command: 'mkdir test',
      };

      const promise = executeCommand(cmd);
      vi.advanceTimersByTime(200);
      const result = await promise;

      expect(result).toEqual({
        description: 'Create directory',
        command: 'mkdir test',
        output: '',
        errors: '',
        result: ExecutionResult.Success,
      });
    });

    it('calls progress callback with running status', async () => {
      const cmd: ExecuteCommand = {
        description: 'Test command',
        command: 'echo test',
      };
      const onProgress = vi.fn();

      const promise = executeCommand(cmd, onProgress);

      // Running is called immediately
      expect(onProgress).toHaveBeenCalledWith(ExecutionStatus.Running);

      vi.advanceTimersByTime(200);
      await promise;

      expect(onProgress).toHaveBeenCalledWith(ExecutionStatus.Success);
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    it('includes command details in output', async () => {
      const cmd: ExecuteCommand = {
        description: 'Install packages',
        command: 'npm install',
        workdir: '/project',
        timeout: 60000,
      };

      const promise = executeCommand(cmd);
      vi.advanceTimersByTime(200);
      const result = await promise;

      expect(result.description).toBe('Install packages');
      expect(result.command).toBe('npm install');
    });
  });

  describe('Execute multiple commands', () => {
    it('executes commands sequentially', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
        { description: 'Step 2', command: 'echo 2' },
        { description: 'Step 3', command: 'echo 3' },
      ];

      const promise = executeCommands(commands);

      // Advance through all commands (0-100ms each)
      await vi.advanceTimersByTimeAsync(500);

      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results[0].description).toBe('Step 1');
      expect(results[1].description).toBe('Step 2');
      expect(results[2].description).toBe('Step 3');
    });

    it('calls progress callback for each command', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
        { description: 'Step 2', command: 'echo 2' },
      ];
      const onProgress = vi.fn();

      const promise = executeCommands(commands, onProgress);

      // Advance through both commands (0-100ms each)
      await vi.advanceTimersByTimeAsync(500);

      await promise;

      // Each command: initial running + running from callback + final status
      const calls = onProgress.mock.calls as ExecutionProgress[][];

      // Find all calls for first command (index 0)
      const firstCmdCalls = calls.filter((call) => call[0].currentIndex === 0);
      // Find all calls for second command (index 1)
      const secondCmdCalls = calls.filter((call) => call[0].currentIndex === 1);

      expect(firstCmdCalls.length).toBeGreaterThan(0);
      expect(secondCmdCalls.length).toBeGreaterThan(0);

      // Verify total is correct
      expect(calls[0][0].total).toBe(2);
    });

    it('reports correct status in progress callbacks', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
      ];
      const progressHistory: ExecutionProgress[] = [];
      const onProgress = (progress: ExecutionProgress) => {
        progressHistory.push({ ...progress });
      };

      const promise = executeCommands(commands, onProgress);
      vi.advanceTimersByTime(200);
      await promise;

      // Should have running and success statuses
      const statuses = progressHistory.map((p) => p.status);
      expect(statuses).toContain(ExecutionStatus.Running);
      expect(statuses).toContain(ExecutionStatus.Success);
    });

    it('returns empty array for empty commands', async () => {
      const results = await executeCommands([]);
      expect(results).toEqual([]);
    });

    it('handles commands without progress callback', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
      ];

      const promise = executeCommands(commands);
      vi.advanceTimersByTime(200);
      const results = await promise;

      expect(results).toHaveLength(1);
      expect(results[0].result).toBe(ExecutionResult.Success);
    });
  });

  describe('DummyExecutor', () => {
    it('uses mocked response when available', async () => {
      const executor = new DummyExecutor(() => 10);
      executor.mock('npm install', {
        output: 'added 100 packages',
        errors: '',
        result: ExecutionResult.Success,
      });

      const cmd: ExecuteCommand = {
        description: 'Install deps',
        command: 'npm install',
      };

      const promise = executor.execute(cmd);
      vi.advanceTimersByTime(50);
      const result = await promise;

      expect(result.output).toBe('added 100 packages');
      expect(result.result).toBe(ExecutionResult.Success);
    });

    it('returns error result when mocked as failed', async () => {
      const executor = new DummyExecutor(() => 10);
      executor.mock('npm test', {
        output: '',
        errors: 'Test failed',
        result: ExecutionResult.Error,
        error: 'Tests did not pass',
      });

      const cmd: ExecuteCommand = {
        description: 'Run tests',
        command: 'npm test',
      };

      const promise = executor.execute(cmd);
      vi.advanceTimersByTime(50);
      const result = await promise;

      expect(result.result).toBe(ExecutionResult.Error);
      expect(result.error).toBe('Tests did not pass');
      expect(result.errors).toBe('Test failed');
    });

    it('calls progress callback with failed status for error result', async () => {
      const executor = new DummyExecutor(() => 10);
      executor.mock('failing-cmd', {
        result: ExecutionResult.Error,
      });

      const cmd: ExecuteCommand = {
        description: 'Failing command',
        command: 'failing-cmd',
      };
      const onProgress = vi.fn();

      const promise = executor.execute(cmd, onProgress);
      vi.advanceTimersByTime(50);
      await promise;

      expect(onProgress).toHaveBeenCalledWith(ExecutionStatus.Running);
      expect(onProgress).toHaveBeenCalledWith(ExecutionStatus.Failed);
    });

    it('clears mocked responses', async () => {
      const executor = new DummyExecutor(() => 10);
      executor.mock('echo test', {
        output: 'mocked output',
      });

      executor.clearMocks();

      const cmd: ExecuteCommand = {
        description: 'Test',
        command: 'echo test',
      };

      const promise = executor.execute(cmd);
      vi.advanceTimersByTime(50);
      const result = await promise;

      // Should return default empty output after clearing mocks
      expect(result.output).toBe('');
    });

    it('uses custom delay generator', async () => {
      // Fixed 50ms delay
      const executor = new DummyExecutor(() => 50);

      const cmd: ExecuteCommand = {
        description: 'Test',
        command: 'echo test',
      };

      const promise = executor.execute(cmd);

      // Should not resolve before 50ms
      vi.advanceTimersByTime(40);
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      // Should resolve after 50ms
      vi.advanceTimersByTime(20);
      await promise;
    });

    it('uses index in delay generator', async () => {
      const delays: number[] = [];
      const executor = new DummyExecutor((index) => {
        delays.push(index);
        return 10;
      });

      const cmd: ExecuteCommand = {
        description: 'Test',
        command: 'echo test',
      };

      const promise = executor.execute(cmd, undefined, 5);
      vi.advanceTimersByTime(50);
      await promise;

      expect(delays).toContain(5);
    });
  });

  describe('Critical command handling', () => {
    it('stops execution when critical command fails', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
        { description: 'Step 2', command: 'echo 2' }, // critical by default
        { description: 'Step 3', command: 'echo 3' },
      ];

      // Mock Step 2 to fail
      testExecutor.mock('echo 2', {
        result: ExecutionResult.Error,
        errors: 'Command failed',
      });

      const promise = executeCommands(commands);
      await vi.advanceTimersByTimeAsync(200);
      const results = await promise;

      testExecutor.clearMocks();

      // Should only have 2 results (stopped after Step 2 failed)
      expect(results).toHaveLength(2);
      expect(results[0].result).toBe(ExecutionResult.Success);
      expect(results[1].result).toBe(ExecutionResult.Error);
    });

    it('continues execution when non-critical command fails', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
        { description: 'Step 2', command: 'echo 2', critical: false },
        { description: 'Step 3', command: 'echo 3' },
      ];

      // Mock Step 2 to fail
      testExecutor.mock('echo 2', {
        result: ExecutionResult.Error,
        errors: 'Command failed',
      });

      const promise = executeCommands(commands);
      await vi.advanceTimersByTimeAsync(200);
      const results = await promise;

      testExecutor.clearMocks();

      // Should have all 3 results (continued after non-critical Step 2 failed)
      expect(results).toHaveLength(3);
      expect(results[0].result).toBe(ExecutionResult.Success);
      expect(results[1].result).toBe(ExecutionResult.Error);
      expect(results[2].result).toBe(ExecutionResult.Success);
    });

    it('defaults critical to true when not specified', () => {
      const cmd: ExecuteCommand = {
        description: 'Test',
        command: 'echo test',
      };

      // critical should default to true (stop on failure)
      const isCritical = cmd.critical !== false;
      expect(isCritical).toBe(true);
    });

    it('respects explicit critical false', () => {
      const cmd: ExecuteCommand = {
        description: 'Test',
        command: 'echo test',
        critical: false,
      };

      const isCritical = cmd.critical !== false;
      expect(isCritical).toBe(false);
    });
  });

  describe('RealExecutor', () => {
    it('executes command and captures stdout', async () => {
      const executor = new RealExecutor();
      const cmd: ExecuteCommand = {
        description: 'Echo test',
        command: 'echo "hello world"',
      };

      const result = await executor.execute(cmd);

      expect(result.result).toBe(ExecutionResult.Success);
      expect(result.output.trim()).toBe('hello world');
      expect(result.errors).toBe('');
    });

    it('captures stderr output', async () => {
      const executor = new RealExecutor();
      const cmd: ExecuteCommand = {
        description: 'Write to stderr',
        command: 'echo "error message" >&2',
      };

      const result = await executor.execute(cmd);

      expect(result.result).toBe(ExecutionResult.Success);
      expect(result.errors.trim()).toBe('error message');
    });

    it('returns error result for non-zero exit code', async () => {
      const executor = new RealExecutor();
      const cmd: ExecuteCommand = {
        description: 'Failing command',
        command: 'exit 1',
      };

      const result = await executor.execute(cmd);

      expect(result.result).toBe(ExecutionResult.Error);
      expect(result.error).toBe('Exit code: 1');
    });

    it('calls output callback with stdout data', async () => {
      const chunks: string[] = [];
      const executor = new RealExecutor((data, stream) => {
        if (stream === 'stdout') chunks.push(data);
      });

      const cmd: ExecuteCommand = {
        description: 'Echo test',
        command: 'echo "callback test"',
      };

      await executor.execute(cmd);

      expect(chunks.join('').trim()).toBe('callback test');
    });

    it('calls output callback with stderr data', async () => {
      const chunks: string[] = [];
      const executor = new RealExecutor((data, stream) => {
        if (stream === 'stderr') chunks.push(data);
      });

      const cmd: ExecuteCommand = {
        description: 'Stderr test',
        command: 'echo "stderr test" >&2',
      };

      await executor.execute(cmd);

      expect(chunks.join('').trim()).toBe('stderr test');
    });

    it('calls progress callback with running and success status', async () => {
      const executor = new RealExecutor();
      const statuses: ExecutionStatus[] = [];

      const cmd: ExecuteCommand = {
        description: 'Progress test',
        command: 'echo "test"',
      };

      await executor.execute(cmd, (status) => statuses.push(status));

      expect(statuses).toContain(ExecutionStatus.Running);
      expect(statuses).toContain(ExecutionStatus.Success);
    });

    it('calls progress callback with failed status on error', async () => {
      const executor = new RealExecutor();
      const statuses: ExecutionStatus[] = [];

      const cmd: ExecuteCommand = {
        description: 'Failing command',
        command: 'exit 42',
      };

      await executor.execute(cmd, (status) => statuses.push(status));

      expect(statuses).toContain(ExecutionStatus.Running);
      expect(statuses).toContain(ExecutionStatus.Failed);
    });

    it('captures multi-line output', async () => {
      const executor = new RealExecutor();
      const cmd: ExecuteCommand = {
        description: 'Multi-line output',
        command: 'echo "line1"; echo "line2"; echo "line3"',
      };

      const result = await executor.execute(cmd);

      expect(result.result).toBe(ExecutionResult.Success);
      expect(result.output.trim()).toBe('line1\nline2\nline3');
    });

    it('allows updating output callback via setOutputCallback', async () => {
      const executor = new RealExecutor();
      const chunks: string[] = [];

      executor.setOutputCallback((data) => chunks.push(data));

      const cmd: ExecuteCommand = {
        description: 'Callback update test',
        command: 'echo "updated"',
      };

      await executor.execute(cmd);

      expect(chunks.join('').trim()).toBe('updated');

      // Clear callback
      executor.setOutputCallback(undefined);
    });
  });
});
