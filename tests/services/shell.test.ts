import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CommandOutput,
  DummyExecutor,
  ExecuteCommand,
  ExecutionProgress,
  ExecutionResult,
  ExecutionStatus,
  limitLines,
  MAX_OUTPUT_LINES,
  OutputStreamer,
  parseWorkdir,
  PWD_MARKER,
} from '../../src/services/shell.js';

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

      // Stop on failure
      if (output.result !== ExecutionResult.Success) {
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

  describe('Command failure handling', () => {
    it('stops execution when command fails', async () => {
      const commands: ExecuteCommand[] = [
        { description: 'Step 1', command: 'echo 1' },
        { description: 'Step 2', command: 'echo 2' },
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
  });
});

describe('limitLines', () => {
  it('returns input unchanged when under limit', () => {
    const input = 'line1\nline2\nline3';
    expect(limitLines(input)).toBe(input);
  });

  it('returns input unchanged when exactly at limit', () => {
    const lines = Array.from(
      { length: MAX_OUTPUT_LINES },
      (_, i) => `line${i}`
    );
    const input = lines.join('\n');
    expect(limitLines(input)).toBe(input);
  });

  it('returns last MAX_OUTPUT_LINES lines when over limit', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line${i}`);
    const input = lines.join('\n');
    const result = limitLines(input);
    const resultLines = result.split('\n');

    expect(resultLines.length).toBe(MAX_OUTPUT_LINES);
    expect(resultLines[0]).toBe(`line${200 - MAX_OUTPUT_LINES}`);
    expect(resultLines[MAX_OUTPUT_LINES - 1]).toBe('line199');
  });

  it('handles empty string', () => {
    expect(limitLines('')).toBe('');
  });

  it('handles single line', () => {
    expect(limitLines('single')).toBe('single');
  });

  it('handles string with only newlines', () => {
    const input = '\n\n\n';
    expect(limitLines(input)).toBe(input);
  });

  it('preserves trailing newline', () => {
    const input = 'line1\nline2\n';
    expect(limitLines(input)).toBe(input);
  });
});

describe('parseWorkdir', () => {
  it('returns raw output when no marker present', () => {
    const result = parseWorkdir('hello world');
    expect(result.output).toBe('hello world');
    expect(result.workdir).toBeUndefined();
  });

  it('extracts workdir after marker', () => {
    const result = parseWorkdir(`output text\n${PWD_MARKER}\n/home/user`);
    expect(result.output).toBe('output text');
    expect(result.workdir).toBe('/home/user');
  });

  it('trims output before marker', () => {
    const result = parseWorkdir(`output text   \n${PWD_MARKER}\n/home/user`);
    expect(result.output).toBe('output text');
  });

  it('handles empty output before marker', () => {
    const result = parseWorkdir(`${PWD_MARKER}\n/home/user`);
    expect(result.output).toBe('');
    expect(result.workdir).toBe('/home/user');
  });

  it('handles multiline output before marker', () => {
    const result = parseWorkdir(`line1\nline2\nline3\n${PWD_MARKER}\n/tmp`);
    expect(result.output).toBe('line1\nline2\nline3');
    expect(result.workdir).toBe('/tmp');
  });

  it('uses last marker when multiple present', () => {
    const result = parseWorkdir(
      `text1\n${PWD_MARKER}\n/first\ntext2\n${PWD_MARKER}\n/second`
    );
    expect(result.output).toBe(`text1\n${PWD_MARKER}\n/first\ntext2`);
    expect(result.workdir).toBe('/second');
  });

  it('handles marker with extra whitespace after path', () => {
    const result = parseWorkdir(`output\n${PWD_MARKER}\n/home/user\n\n`);
    expect(result.workdir).toBe('/home/user');
  });

  it('handles empty string', () => {
    const result = parseWorkdir('');
    expect(result.output).toBe('');
    expect(result.workdir).toBeUndefined();
  });

  it('handles marker at very end without path', () => {
    const result = parseWorkdir(`output\n${PWD_MARKER}`);
    expect(result.output).toBe('output');
    expect(result.workdir).toBeUndefined();
  });
});

describe('OutputStreamer', () => {
  it('accumulates chunks without callback', () => {
    const streamer = new OutputStreamer();
    streamer.pushStdout('hello ');
    streamer.pushStdout('world');
    expect(streamer.getAccumulated()).toBe('hello world');
  });

  it('emits chunks to callback when content exceeds buffer threshold', () => {
    const chunks: string[] = [];
    const streamer = new OutputStreamer((data) => chunks.push(data));

    // Must push enough content to exceed buffer threshold (marker length + 5)
    streamer.pushStdout(
      'this is enough content to exceed the buffer threshold'
    );

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('buffers to avoid emitting partial marker', () => {
    const chunks: string[] = [];
    const streamer = new OutputStreamer((data) => chunks.push(data));

    // Push text that could be start of marker
    streamer.pushStdout('output__PWD');
    const emittedSoFar = chunks.join('');

    // Should buffer the potential marker start
    expect(emittedSoFar.length).toBeLessThan('output__PWD'.length);
  });

  it('filters marker from streamed output', () => {
    const chunks: string[] = [];
    const streamer = new OutputStreamer((data) => chunks.push(data));

    streamer.pushStdout(`visible output\n${PWD_MARKER}\n/home/user`);
    const emitted = chunks.join('');

    expect(emitted).not.toContain(PWD_MARKER);
    expect(emitted).toContain('visible output');
  });

  it('stops emitting after marker found', () => {
    const chunks: string[] = [];
    const streamer = new OutputStreamer((data) => chunks.push(data));

    streamer.pushStdout(`before\n${PWD_MARKER}\nafter`);
    const emitted = chunks.join('');

    expect(emitted).toContain('before');
    expect(emitted).not.toContain('after');
  });

  it('handles marker split across chunks', () => {
    const chunks: string[] = [];
    const streamer = new OutputStreamer((data) => chunks.push(data));

    // Split marker across two pushes
    const markerHalf = PWD_MARKER.substring(0, PWD_MARKER.length / 2);
    const markerRest = PWD_MARKER.substring(PWD_MARKER.length / 2);

    streamer.pushStdout(`output\n${markerHalf}`);
    streamer.pushStdout(`${markerRest}\n/path`);

    const emitted = chunks.join('');
    expect(emitted).not.toContain(PWD_MARKER);
  });

  it('collapses chunks when exceeding 16 chunks', () => {
    const streamer = new OutputStreamer();

    // Push more than 16 chunks
    for (let i = 0; i < 20; i++) {
      streamer.pushStdout(`chunk${i}\n`);
    }

    const accumulated = streamer.getAccumulated();
    // Should have all content but internally collapsed
    expect(accumulated).toContain('chunk0');
    expect(accumulated).toContain('chunk19');
  });

  it('limits accumulated output to MAX_OUTPUT_LINES on collapse', () => {
    const streamer = new OutputStreamer();

    // Push many lines across many chunks to trigger collapse
    for (let i = 0; i < 20; i++) {
      const lines = Array.from({ length: 20 }, (_, j) => `chunk${i}-line${j}`);
      streamer.pushStdout(lines.join('\n') + '\n');
    }

    const accumulated = streamer.getAccumulated();
    const lineCount = accumulated.split('\n').length;

    expect(lineCount).toBeLessThanOrEqual(MAX_OUTPUT_LINES + 1);
  });

  it('handles empty pushes gracefully', () => {
    const chunks: string[] = [];
    const streamer = new OutputStreamer((data) => chunks.push(data));

    streamer.pushStdout('');
    streamer.pushStdout('');
    streamer.pushStdout('content');

    expect(streamer.getAccumulated()).toBe('content');
  });

  it('preserves content when no callback provided', () => {
    const streamer = new OutputStreamer();

    streamer.pushStdout('line1\n');
    streamer.pushStdout('line2\n');
    streamer.pushStdout('line3');

    expect(streamer.getAccumulated()).toBe('line1\nline2\nline3');
  });
});
