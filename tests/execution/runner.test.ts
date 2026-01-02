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
    vi.advanceTimersByTime(100);
    expect(callbacks.onUpdate).toHaveBeenCalledTimes(2);
    expect(callbacks.updates[1].stdout).toContain('line 4');

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
    expect(lastUpdate.stdout).toBe('final output');
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
});
