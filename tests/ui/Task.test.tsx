import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Task } from '../../src/ui/Task.js';

// Mock timing and shell execution
vi.mock('../../src/services/shell.js', async () => {
  const actual = await vi.importActual('../../src/services/shell.js');
  return {
    ...actual,
    executeCommand: vi.fn().mockResolvedValue({
      description: 'Test',
      command: 'test-cmd',
      output: 'success',
      errors: '',
      result: 'success',
    }),
  };
});

// Import after mock
const { ExecutionResult, ExecutionStatus } =
  await import('../../src/services/shell.js');

vi.useFakeTimers();

describe('Task component', () => {
  const mockCommand = {
    description: 'Run tests',
    command: 'npm test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('starts with pending status by default', () => {
      const { lastFrame } = render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={false}
          index={0}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('- ');
    });

    it('uses initialStatus when provided', () => {
      const { lastFrame } = render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={false}
          index={0}
          initialStatus={ExecutionStatus.Success}
          initialElapsed={1000}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('✓ ');
      expect(frame).toContain('1 second');
    });

    it('uses initialElapsed when provided', () => {
      const { lastFrame } = render(
        <Task
          label="Build project"
          command={mockCommand}
          isActive={false}
          index={0}
          initialStatus={ExecutionStatus.Success}
          initialElapsed={3500}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('3 seconds');
    });
  });

  describe('Task execution', () => {
    it('executes when becoming active', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      const onComplete = vi.fn();

      render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={true}
          index={0}
          onComplete={onComplete}
        />
      );

      await vi.waitFor(
        () => {
          expect(executeCommand).toHaveBeenCalledWith(
            mockCommand,
            undefined,
            0
          );
        },
        { timeout: 500 }
      );
    });

    it('calls onComplete with elapsed time on success', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      vi.mocked(executeCommand).mockResolvedValue({
        description: 'Test',
        command: 'test-cmd',
        output: 'success',
        errors: '',
        result: ExecutionResult.Success,
      });

      const onComplete = vi.fn();

      render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={true}
          index={0}
          onComplete={onComplete}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const [index, output, elapsed] = onComplete.mock.calls[0];
      expect(index).toBe(0);
      expect(output.result).toBe(ExecutionResult.Success);
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('calls onError with elapsed time on failure', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      vi.mocked(executeCommand).mockResolvedValue({
        description: 'Test',
        command: 'test-cmd',
        output: '',
        errors: 'Test failed',
        result: ExecutionResult.Error,
      });

      const onError = vi.fn();

      render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={true}
          index={0}
          onError={onError}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const [index, error, elapsed] = onError.mock.calls[0];
      expect(index).toBe(0);
      expect(error).toBe('Test failed');
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it('calls onError with elapsed time on exception', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      vi.mocked(executeCommand).mockRejectedValue(
        new Error('Execution failed')
      );

      const onError = vi.fn();

      render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={true}
          index={0}
          onError={onError}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const [index, error, elapsed] = onError.mock.calls[0];
      expect(index).toBe(0);
      expect(error).toBe('Execution failed');
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cancelled status handling', () => {
    it('does not execute if status is cancelled', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      render(
        <Task
          label="Run test suite"
          command={mockCommand}
          isActive={true}
          index={0}
          initialStatus={ExecutionStatus.Cancelled}
        />
      );

      await vi.advanceTimersByTimeAsync(100);

      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('Abort handling', () => {
    it('calls onAbort when task becomes inactive while running', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      vi.mocked(executeCommand).mockImplementation(
        async () =>
          new Promise((resolve) =>
            setTimeout(() => {
              resolve({
                description: 'Test',
                command: 'test-cmd',
                output: '',
                errors: '',
                result: ExecutionResult.Success,
              });
            }, 1000)
          )
      );

      const onAbort = vi.fn();

      const { rerender } = render(
        <Task
          label="Long task"
          command={mockCommand}
          isActive={true}
          index={0}
          onAbort={onAbort}
        />
      );

      // Wait for task to start
      await vi.advanceTimersByTimeAsync(10);

      // Deactivate task (abort)
      rerender(
        <Task
          label="Long task"
          command={mockCommand}
          isActive={false}
          index={0}
          onAbort={onAbort}
        />
      );

      await vi.waitFor(
        () => {
          expect(onAbort).toHaveBeenCalledWith(0);
        },
        { timeout: 200 }
      );
    });
  });

  describe('Elapsed time tracking', () => {
    it('preserves elapsed time after completion', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      vi.mocked(executeCommand).mockResolvedValue({
        description: 'Test',
        command: 'test-cmd',
        output: 'success',
        errors: '',
        result: ExecutionResult.Success,
      });

      const onComplete = vi.fn();

      render(
        <Task
          label="Quick task"
          command={mockCommand}
          isActive={true}
          index={0}
          onComplete={onComplete}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const [, , elapsed] = onComplete.mock.calls[0];
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });
});
