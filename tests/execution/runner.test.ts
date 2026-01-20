import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionResult, ExecutionStatus } from '../../src/services/shell.js';

import type {
  ExecutionOutput,
  TaskExecutionCallbacks,
} from '../../src/execution/runner.js';

// Capture the output callback for testing
let capturedOutputCallback:
  | ((data: string, stream: 'stdout' | 'stderr') => void)
  | undefined;

// Mock resolver for executeCommand
let executeCommandResolver:
  | ((result: {
      description: string;
      command: string;
      output: string;
      errors: string;
      result: ExecutionResult;
      workdir?: string;
      error?: string;
    }) => void)
  | undefined;

vi.mock('../../src/services/shell.js', async () => {
  const actual = await vi.importActual('../../src/services/shell.js');
  return {
    ...actual,
    setOutputCallback: vi.fn((callback) => {
      capturedOutputCallback = callback;
    }),
    executeCommand: vi.fn(
      () =>
        new Promise((resolve) => {
          executeCommandResolver = resolve;
        })
    ),
  };
});

import { executeTask } from '../../src/execution/runner.js';

describe('Execution runner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedOutputCallback = undefined;
    executeCommandResolver = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockCallbacks = (): TaskExecutionCallbacks & {
    updates: ExecutionOutput[];
  } => {
    const updates: ExecutionOutput[] = [];
    return {
      updates,
      onUpdate: vi.fn((output) => updates.push({ ...output })),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };
  };

  it('throttles rapid output updates to prevent UI lag', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'rapid output' },
      0,
      callbacks
    );

    // Simulate rapid output (e.g., npm install, compiler output)
    capturedOutputCallback?.('line 1\n', 'stdout');
    capturedOutputCallback?.('line 2\n', 'stdout');
    capturedOutputCallback?.('line 3\n', 'stdout');
    capturedOutputCallback?.('line 4\n', 'stdout');

    // Only first update should fire immediately, rest are batched
    expect(callbacks.onUpdate).toHaveBeenCalledTimes(1);

    // After throttle interval, batched update fires
    vi.advanceTimersByTime(80);
    expect(callbacks.onUpdate).toHaveBeenCalledTimes(2);
    // Check that chunks contain the output
    const combinedText = callbacks.updates[1].chunks
      .map((c) => c.text)
      .join('');
    expect(combinedText).toContain('line 4');

    executeCommandResolver?.({
      description: 'Test',
      command: 'rapid output',
      output: 'done',
      errors: '',
      result: ExecutionResult.Success,
    });
    await taskPromise;
  });

  it('sends final update before onComplete so UI shows final state', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'echo done' },
      0,
      callbacks
    );

    executeCommandResolver?.({
      description: 'Test',
      command: 'echo done',
      output: 'final output',
      errors: '',
      result: ExecutionResult.Success,
      workdir: '/final/dir',
    });

    const result = await taskPromise;

    // Final update must be called with complete output
    const lastUpdate = callbacks.updates[callbacks.updates.length - 1];
    // Output is now in chunks, check workdir is set
    expect(lastUpdate.workdir).toBe('/final/dir');

    // onComplete receives the same final state
    expect(callbacks.onComplete).toHaveBeenCalledWith(
      expect.any(Number),
      lastUpdate
    );
    expect(result.status).toBe(ExecutionStatus.Success);
  });

  it('sends final update before onError so UI shows error state', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'fail' },
      0,
      callbacks
    );

    executeCommandResolver?.({
      description: 'Test',
      command: 'fail',
      output: '',
      errors: 'command failed',
      result: ExecutionResult.Error,
    });

    const result = await taskPromise;

    // Final update must include error info
    const lastUpdate = callbacks.updates[callbacks.updates.length - 1];
    expect(lastUpdate.error).toBe('command failed');

    // onError receives the same final state
    expect(callbacks.onError).toHaveBeenCalledWith(
      'command failed',
      lastUpdate
    );
    expect(result.status).toBe(ExecutionStatus.Failed);
  });

  it('prioritizes result.error over result.errors for error message', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'memory fail' },
      0,
      callbacks
    );

    executeCommandResolver?.({
      description: 'Test',
      command: 'memory fail',
      output: '',
      errors: 'some stderr output',
      result: ExecutionResult.Error,
      error: 'Process exceeded 100 MB memory limit, 120 MB was used.',
    });

    await taskPromise;

    // Should use result.error (specific message) not result.errors (stderr)
    expect(callbacks.onError).toHaveBeenCalledWith(
      'Process exceeded 100 MB memory limit, 120 MB was used.',
      expect.any(Object)
    );
  });

  it('falls back to result.errors when result.error is undefined', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'stderr fail' },
      0,
      callbacks
    );

    executeCommandResolver?.({
      description: 'Test',
      command: 'stderr fail',
      output: '',
      errors: 'command not found',
      result: ExecutionResult.Error,
    });

    await taskPromise;

    expect(callbacks.onError).toHaveBeenCalledWith(
      'command not found',
      expect.any(Object)
    );
  });

  it('does not duplicate output when already captured via streaming', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'echo hello' },
      0,
      callbacks
    );

    // Simulate streaming output
    capturedOutputCallback?.('hello\n', 'stdout');

    // Result also contains the same output
    executeCommandResolver?.({
      description: 'Test',
      command: 'echo hello',
      output: 'hello\n',
      errors: '',
      result: ExecutionResult.Success,
    });

    await taskPromise;

    // Get final output chunks
    const lastUpdate = callbacks.updates[callbacks.updates.length - 1];
    const stdoutChunks = lastUpdate.chunks.filter((c) => c.source === 'stdout');

    // Should only have one stdout chunk (from streaming), not duplicated
    expect(stdoutChunks).toHaveLength(1);
    expect(stdoutChunks[0].text).toBe('hello\n');
  });

  it('does not duplicate stderr when already captured via streaming', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'warn' },
      0,
      callbacks
    );

    // Simulate streaming stderr
    capturedOutputCallback?.('warning message\n', 'stderr');

    // Result also contains the same stderr
    executeCommandResolver?.({
      description: 'Test',
      command: 'warn',
      output: '',
      errors: 'warning message\n',
      result: ExecutionResult.Success,
    });

    await taskPromise;

    // Get final output chunks
    const lastUpdate = callbacks.updates[callbacks.updates.length - 1];
    const stderrChunks = lastUpdate.chunks.filter((c) => c.source === 'stderr');

    // Should only have one stderr chunk (from streaming), not duplicated
    expect(stderrChunks).toHaveLength(1);
    expect(stderrChunks[0].text).toBe('warning message\n');
  });

  it('adds result output when no streaming occurred', async () => {
    const callbacks = createMockCallbacks();
    const taskPromise = executeTask(
      { description: 'Test', command: 'quick' },
      0,
      callbacks
    );

    // No streaming, just final result
    executeCommandResolver?.({
      description: 'Test',
      command: 'quick',
      output: 'quick output',
      errors: '',
      result: ExecutionResult.Success,
    });

    await taskPromise;

    // Get final output chunks
    const lastUpdate = callbacks.updates[callbacks.updates.length - 1];
    const stdoutChunks = lastUpdate.chunks.filter((c) => c.source === 'stdout');

    // Should have the output from result since nothing was streamed
    expect(stdoutChunks).toHaveLength(1);
    expect(stdoutChunks[0].text).toBe('quick output');
  });
});
