import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentStatus, ExecuteState } from '../../src/types/components.js';
import { TaskType } from '../../src/types/types.js';

import { ExecutionResult } from '../../src/services/shell.js';

import { Execute, ExecuteView } from '../../src/ui/Execute.js';

import {
  createRequestHandlers,
  createLifecycleHandlers,
  createMockAnthropicService,
  createMockDebugComponents,
  createWorkflowHandlers,
} from '../test-utils.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

vi.useFakeTimers();

// Mock config loader to provide test config
vi.mock('../../src/services/loader.js', () => ({
  loadUserConfig: vi.fn().mockReturnValue({
    project: {
      alpha: {
        path: '/home/user/alpha',
      },
      beta: {
        path: '/home/user/beta',
      },
    },
  }),
  hasConfigPath: vi.fn().mockReturnValue(true),
}));

// Mock shell service to avoid actual command execution
vi.mock('../../src/services/shell.js', async () => {
  const actual = await vi.importActual('../../src/services/shell.js');
  return {
    ...actual,
    executeCommand: vi
      .fn()
      .mockImplementation(
        async (cmd: { description: string; command: string }) => {
          // Simulate immediate execution for tests
          return {
            description: cmd.description,
            command: cmd.command,
            output: '',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      ),
    executeCommands: vi
      .fn()
      .mockImplementation(async (commands, onProgress) => {
        // Simulate immediate execution for tests
        const results = commands.map(
          (cmd: { description: string; command: string }, index: number) => {
            onProgress?.({
              currentIndex: index,
              total: commands.length,
              command: cmd,
              status: 'running',
            });
            const output = {
              description: cmd.description,
              command: cmd.command,
              output: '',
              errors: '',
              result: ExecutionResult.Success,
            };
            onProgress?.({
              currentIndex: index,
              total: commands.length,
              command: cmd,
              status: 'success',
              output,
            });
            return output;
          }
        );
        return results;
      }),
  };
});

describe('Execute component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while preparing commands', () => {
    const service = createMockAnthropicService({
      message: 'Setting up project.',
      commands: [{ description: 'Create directory', command: 'mkdir test' }],
    });

    const tasks = [
      { action: 'Create project directory', type: TaskType.Execute },
    ];

    const { lastFrame } = render(
      <Execute
        tasks={tasks}
        service={service}
        requestHandlers={createRequestHandlers<ExecuteState>()}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    expect(lastFrame()).toContain('Preparing commands.');
  });

  it('returns null when done with no commands', () => {
    const tasks = [{ action: 'Test', type: TaskType.Execute }];

    const { lastFrame } = render(
      <ExecuteView
        tasks={tasks}
        state={{
          error: null,
          message: '',
          summary: '',
          taskInfos: [],
          completed: 0,
          taskExecutionTimes: [],
          completionMessage: null,
        }}
        status={ComponentStatus.Done}
      />
    );

    expect(lastFrame()).toBe('');
  });

  it('calls completeActive when successful', async () => {
    const service = createMockAnthropicService({
      message: 'Setting up project.',
      commands: [
        { description: 'Create directory', command: 'mkdir test' },
        { description: 'Initialize git', command: 'git init' },
      ],
    });
    const completeActive = vi.fn();

    const tasks = [
      { action: 'Create project directory', type: TaskType.Execute },
      { action: 'Initialize git repository', type: TaskType.Execute },
    ];

    render(
      <Execute
        tasks={tasks}
        service={service}
        requestHandlers={createRequestHandlers<ExecuteState>()}
        lifecycleHandlers={createLifecycleHandlers({ completeActive })}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    await vi.waitFor(
      () => {
        expect(completeActive).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('calls onError when service fails', async () => {
    const errorMessage = 'API error';
    const service = createMockAnthropicService({}, new Error(errorMessage));
    const onError = vi.fn();

    const tasks = [{ action: 'Test', type: TaskType.Execute }];

    render(
      <Execute
        tasks={tasks}
        service={service}
        lifecycleHandlers={createLifecycleHandlers()}
        requestHandlers={createRequestHandlers({ onError })}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    await vi.waitFor(
      () => {
        expect(onError).toHaveBeenCalledWith(errorMessage);
      },
      { timeout: 500 }
    );
  });

  it('handles escape key to abort', () => {
    const service = createMockAnthropicService({
      message: 'Setting up.',
      commands: [{ description: 'Test', command: 'echo test' }],
    });
    const onAborted = vi.fn();

    const tasks = [{ action: 'Test', type: TaskType.Execute }];

    const { stdin } = render(
      <Execute
        tasks={tasks}
        service={service}
        lifecycleHandlers={createLifecycleHandlers()}
        requestHandlers={createRequestHandlers({ onAborted })}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    stdin.write('\x1b'); // Escape key

    expect(onAborted).toHaveBeenCalled();
  });

  it('calls onAborted when aborting execution', async () => {
    const service = createMockAnthropicService({
      message: 'Processing.',
      commands: [{ description: 'Long task', command: 'sleep 10' }],
    });
    const onAborted = vi.fn();

    const tasks = [{ action: 'Run long task', type: TaskType.Execute }];

    const { stdin, lastFrame } = render(
      <Execute
        tasks={tasks}
        service={service}
        lifecycleHandlers={createLifecycleHandlers()}
        requestHandlers={createRequestHandlers({ onAborted })}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    // Wait for execution UI to appear (command is being executed)
    await vi.waitFor(
      () => {
        const frame = lastFrame();
        return frame?.includes('Long task') || frame?.includes('Processing.');
      },
      { timeout: 500 }
    );

    // Abort during execution
    stdin.write('\x1b'); // Escape key

    // Should have called onAborted
    expect(onAborted).toHaveBeenCalled();
  });

  it('sets command status to aborted when cancelled', async () => {
    const service = createMockAnthropicService({
      message: 'Processing.',
      commands: [{ description: 'Long task', command: 'sleep 10' }],
    });
    const onAborted = vi.fn();

    const tasks = [{ action: 'Run long task', type: TaskType.Execute }];

    const { stdin, lastFrame } = render(
      <Execute
        tasks={tasks}
        service={service}
        lifecycleHandlers={createLifecycleHandlers()}
        requestHandlers={createRequestHandlers({ onAborted })}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    // Wait for execution UI to appear
    await vi.waitFor(
      () => {
        const frame = lastFrame();
        return frame?.includes('Long task') || frame?.includes('Processing.');
      },
      { timeout: 500 }
    );

    stdin.write('\x1b'); // Escape key

    // onAborted should be called with operation name
    expect(onAborted).toHaveBeenCalledWith('execution');
  });

  it('calls completeActive when no commands returned', async () => {
    const service = createMockAnthropicService({
      message: '',
      commands: [],
    });
    const completeActive = vi.fn();

    const tasks = [{ action: 'Nothing', type: TaskType.Execute }];

    render(
      <Execute
        tasks={tasks}
        service={service}
        requestHandlers={createRequestHandlers<ExecuteState>()}
        lifecycleHandlers={createLifecycleHandlers({ completeActive })}
        workflowHandlers={createWorkflowHandlers()}
        status={ComponentStatus.Active}
      />
    );

    await vi.waitFor(
      () => {
        expect(completeActive).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  describe('Placeholder resolution', () => {
    it('resolves single placeholder', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const service = createMockAnthropicService({
        message: 'Navigating to repository.',
        commands: [
          {
            description: 'Navigate to project directory',
            command: 'cd {project.alpha.path}',
          },
        ],
      });

      const tasks = [
        {
          action: 'Navigate to Alpha project directory',
          type: TaskType.Execute,
        },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(executeCommand).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const commandArg = vi.mocked(executeCommand).mock.calls[0][0];
      expect(commandArg.command).toBe('cd /home/user/alpha');
    });

    it('resolves multiple placeholders in one command', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const service = createMockAnthropicService({
        message: 'Syncing projects.',
        commands: [
          {
            description: 'Sync from main to test',
            command: 'rsync -av {project.alpha.path}/ {project.beta.path}/',
          },
        ],
      });

      const tasks = [
        {
          action: 'Sync alpha project to beta environment',
          type: TaskType.Execute,
        },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(executeCommand).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const commandArg = vi.mocked(executeCommand).mock.calls[0][0];
      expect(commandArg.command).toBe(
        'rsync -av /home/user/alpha/ /home/user/beta/'
      );
    });

    it('throws error when placeholders cannot be resolved', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');
      const errorHandlers = createRequestHandlers();

      const service = createMockAnthropicService({
        message: 'Deploying.',
        commands: [
          {
            description: 'Deploy to server',
            command: 'deploy --path {project.alpha.path} --token {api.secret}',
          },
        ],
      });

      const tasks = [
        {
          action: 'Deploy to API server',
          type: TaskType.Execute,
        },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={errorHandlers}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(errorHandlers.onError).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Verify error was reported
      expect(errorHandlers.onError).toHaveBeenCalled();
      const errorMessage = vi.mocked(errorHandlers.onError).mock.calls[0][0];
      expect(errorMessage).toBeTruthy();

      // Verify executeCommand was never called
      expect(executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('Command failure handling', () => {
    it('stops execution when critical command fails', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      // First command fails, second should not execute
      vi.mocked(executeCommand).mockImplementation(
        async (cmd: { command: string }) => {
          if (cmd.command === 'build-project') {
            return {
              description: 'Build project',
              command: 'build-project',
              output: '',
              errors: 'Build failed: compilation error',
              result: ExecutionResult.Error,
            };
          }
          return {
            description: 'Test',
            command: cmd.command,
            output: '',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      );

      const service = createMockAnthropicService({
        message: 'Building and deploying.',
        commands: [
          {
            description: 'Build project',
            command: 'build-project',
            critical: true,
          },
          {
            description: 'Deploy to production',
            command: 'deploy-prod',
            critical: true,
          },
        ],
      });

      const onError = vi.fn();
      const tasks = [
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Deploy to production', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({ onError })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Verify deploy command was never executed
      const calls = vi.mocked(executeCommand).mock.calls;
      expect(calls.some((call) => call[0].command === 'deploy-prod')).toBe(
        false
      );
    });

    it('continues execution when non-critical command fails', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      let callCount = 0;
      vi.mocked(executeCommand).mockImplementation(
        async (cmd: { command: string }) => {
          callCount++;
          if (cmd.command === 'lint-code') {
            return {
              description: 'Lint code',
              command: 'lint-code',
              output: '',
              errors: 'Linting warnings found',
              result: ExecutionResult.Error,
            };
          }
          return {
            description: 'Command',
            command: cmd.command,
            output: 'success',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      );

      const service = createMockAnthropicService({
        message: 'Running checks and build.',
        commands: [
          {
            description: 'Lint code',
            command: 'lint-code',
            critical: false,
          },
          {
            description: 'Run tests',
            command: 'test-suite',
            critical: true,
          },
          {
            description: 'Build project',
            command: 'build-project',
            critical: true,
          },
        ],
      });

      const completeActive = vi.fn();
      const tasks = [
        { action: 'Lint code', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
        { action: 'Build project', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers({ completeActive })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(completeActive).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // All three commands should have been executed despite lint failure
      expect(callCount).toBe(3);
    });

    it('shows appropriate error message for failed command', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const errorMessage = 'Permission denied: cannot write to /usr/local';
      vi.mocked(executeCommand).mockResolvedValue({
        description: 'Install package',
        command: 'install-pkg',
        output: '',
        errors: errorMessage,
        result: ExecutionResult.Error,
      });

      const service = createMockAnthropicService({
        message: 'Installing package.',
        commands: [
          {
            description: 'Install package',
            command: 'install-pkg',
          },
        ],
      });

      const onError = vi.fn();
      const tasks = [{ action: 'Install package', type: TaskType.Execute }];

      render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({ onError })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalledWith(errorMessage);
        },
        { timeout: 500 }
      );
    });
  });

  describe('Multi-task execution', () => {
    it('executes multiple tasks in sequence', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const executionOrder: string[] = [];
      vi.mocked(executeCommand).mockImplementation(
        async (cmd: { command: string }) => {
          executionOrder.push(cmd.command);
          return {
            description: 'Command',
            command: cmd.command,
            output: 'done',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      );

      const service = createMockAnthropicService({
        message: 'Setting up environment.',
        commands: [
          { description: 'Install deps', command: 'npm install' },
          { description: 'Build project', command: 'npm run build' },
          { description: 'Run tests', command: 'npm test' },
        ],
      });

      const completeActive = vi.fn();
      const tasks = [
        { action: 'Install dependencies', type: TaskType.Execute },
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Run test suite', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers({ completeActive })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(completeActive).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Verify tasks executed in order
      expect(executionOrder).toEqual([
        'npm install',
        'npm run build',
        'npm test',
      ]);
    });

    it('maintains task state across execution', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      let taskIndex = 0;
      vi.mocked(executeCommand).mockImplementation(async () => {
        const current = taskIndex++;
        return {
          description: `Task ${current}`,
          command: `cmd-${current}`,
          output: `output-${current}`,
          errors: '',
          result: ExecutionResult.Success,
        };
      });

      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first' },
          { description: 'Second', command: 'second' },
        ],
      });

      const onCompleted = vi.fn();
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers({ onCompleted })}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(taskIndex).toBe(2);
        },
        { timeout: 500 }
      );

      // Verify state was updated
      expect(onCompleted).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('handles empty command string', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const service = createMockAnthropicService({
        message: 'Processing.',
        commands: [{ description: 'Empty command', command: '' }],
      });

      const tasks = [{ action: 'Do nothing', type: TaskType.Execute }];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(executeCommand).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const commandArg = vi.mocked(executeCommand).mock.calls[0][0];
      expect(commandArg.command).toBe('');
    });

    it('handles commands with special characters', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const specialCommand = 'echo "Hello $USER" && ls -la | grep "*.txt"';
      const service = createMockAnthropicService({
        message: 'Running special command.',
        commands: [
          {
            description: 'Special chars',
            command: specialCommand,
          },
        ],
      });

      const tasks = [
        {
          action: 'Execute command with special characters',
          type: TaskType.Execute,
        },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(executeCommand).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const commandArg = vi.mocked(executeCommand).mock.calls[0][0];
      expect(commandArg.command).toBe(specialCommand);
    });

    it('handles very long command descriptions', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const longDescription =
        'This is a very long description that exceeds the normal length ' +
        'and contains detailed information about what the command does, ' +
        'including multiple clauses and technical details that might be ' +
        'important for understanding the execution context';

      const service = createMockAnthropicService({
        message: 'Processing.',
        commands: [
          {
            description: longDescription,
            command: 'short-cmd',
          },
        ],
      });

      const tasks = [
        { action: 'Long description task', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(executeCommand).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      const commandArg = vi.mocked(executeCommand).mock.calls[0][0];
      expect(commandArg.description).toBe(longDescription);
    });
  });

  describe('Abort scenarios', () => {
    it('handles abort during multi-task execution', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      const executedCommands: string[] = [];
      vi.mocked(executeCommand).mockImplementation(
        async (cmd: { command: string }) => {
          executedCommands.push(cmd.command);
          // Simulate slow execution
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {
            description: 'Command',
            command: cmd.command,
            output: '',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      );

      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first' },
          { description: 'Second', command: 'second' },
          { description: 'Third', command: 'third' },
        ],
      });

      const onAborted = vi.fn();
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
        { action: 'Third task', type: TaskType.Execute },
      ];

      const { stdin, lastFrame } = render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({ onAborted })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      // Wait for first task to start
      await vi.waitFor(
        () => {
          return lastFrame()?.includes('First');
        },
        { timeout: 500 }
      );

      // Abort during execution
      stdin.write('\x1b'); // Escape

      expect(onAborted).toHaveBeenCalledWith('execution');

      // Second and third commands should not execute
      await vi.waitFor(
        () => {
          expect(executedCommands.length).toBeLessThan(3);
        },
        { timeout: 200 }
      );
    });

    it('marks running task as aborted when execution cancelled', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      vi.mocked(executeCommand).mockImplementation(async () => {
        // Simulate long-running command
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          description: 'Long task',
          command: 'sleep',
          output: '',
          errors: '',
          result: ExecutionResult.Success,
        };
      });

      const service = createMockAnthropicService({
        message: 'Running long task.',
        commands: [
          {
            description: 'Long running task',
            command: 'sleep 10',
          },
        ],
      });

      const onAborted = vi.fn();
      const tasks = [{ action: 'Long task', type: TaskType.Execute }];

      const { stdin, lastFrame } = render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({ onAborted })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      // Wait for task to start executing
      await vi.waitFor(
        () => {
          return lastFrame()?.includes('Long');
        },
        { timeout: 500 }
      );

      // Abort
      stdin.write('\x1b');

      // Should show aborted status
      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(onAborted).toHaveBeenCalled();
          // The task should be marked as aborted in the UI
          return frame?.includes('⊘') || frame?.includes('abort');
        },
        { timeout: 500 }
      );
    });
  });

  describe('Completion summary', () => {
    it('shows completion message with summary and time', async () => {
      const { lastFrame } = render(
        <ExecuteView
          tasks={[{ action: 'Do something', type: TaskType.Execute }]}
          state={{
            error: null,
            message: 'Execute commands:',
            summary: 'All tasks completed successfully',
            taskInfos: [
              {
                label: 'Do something',
                command: { description: 'First task', command: 'echo "first"' },
              },
              {
                label: 'Do something',
                command: {
                  description: 'Second task',
                  command: 'echo "second"',
                },
              },
            ],
            completed: 2,
            taskExecutionTimes: [0, 0],
            completionMessage: 'All tasks completed successfully in 0 seconds.',
          }}
          status={ComponentStatus.Done}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('All tasks completed successfully');
      expect(frame).toContain('in');
      expect(frame).toContain('second');
    });

    it('uses fallback message when summary is empty', async () => {
      const { lastFrame } = render(
        <ExecuteView
          tasks={[{ action: 'Do something', type: TaskType.Execute }]}
          state={{
            error: null,
            message: 'Execute commands:',
            summary: '',
            taskInfos: [
              {
                label: 'Do something',
                command: { description: 'Task', command: 'echo "test"' },
              },
            ],
            completed: 1,
            taskExecutionTimes: [0],
            completionMessage: 'Execution completed in 0 seconds.',
          }}
          status={ComponentStatus.Done}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('Execution completed');
      expect(frame).toContain('in');
      expect(frame).toContain('second');
    });

    it('stores execution times in state', async () => {
      const service = createMockAnthropicService({
        message: 'Execute commands:',
        summary: 'Tasks done',
        commands: [
          { description: 'First', command: 'cmd1' },
          { description: 'Second', command: 'cmd2' },
        ],
      });

      const requestHandlers = createRequestHandlers();
      render(
        <Execute
          tasks={[{ action: 'Do something', type: TaskType.Execute }]}
          status={ComponentStatus.Active}
          service={service}
          requestHandlers={requestHandlers}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Wait for execution to complete
      await vi.advanceTimersByTimeAsync(2000);

      await vi.waitFor(
        () => {
          expect(requestHandlers.onCompleted).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // Check that onCompleted was called with execution times
      const onCompletedMock = vi.mocked(requestHandlers.onCompleted);
      const onCompletedCalls = onCompletedMock.mock.calls;
      const finalCall = onCompletedCalls[onCompletedCalls.length - 1];
      expect(finalCall[0]).toHaveProperty('taskExecutionTimes');
      expect(finalCall[0]).toHaveProperty('completionMessage');
    });
  });

  describe('Debug handling', () => {
    it('adds debug components to timeline', async () => {
      const debugComponents = createMockDebugComponents('execute');

      const service = createMockAnthropicService({
        message: 'Execute commands:',
        summary: 'Commands executed',
        commands: [{ description: 'Test command', command: 'echo test' }],
        debug: debugComponents,
      });

      const workflowHandlers = createWorkflowHandlers();

      render(
        <Execute
          tasks={[{ action: 'Run test', type: TaskType.Execute }]}
          status={ComponentStatus.Active}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
        />
      );

      // Wait for processing
      await vi.advanceTimersByTimeAsync(1000);

      // Check that addToTimeline was called with debug components
      expect(workflowHandlers.addToTimeline).toHaveBeenCalledWith(
        ...debugComponents
      );
    });
  });

  describe('Completed field tracking', () => {
    it('starts with completed at 0 when execution begins', async () => {
      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first' },
          { description: 'Second', command: 'second' },
        ],
      });

      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
      ];

      // Start with no state, should initialize completed to 0
      const { lastFrame } = render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers<ExecuteState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      // Wait for execution to start
      await vi.advanceTimersByTimeAsync(100);

      // Component should start rendering tasks (completed starts at 0)
      const frame = lastFrame();
      expect(frame).toBeTruthy();
    });

    it('increments completed as tasks finish successfully', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      let executionCount = 0;
      vi.mocked(executeCommand).mockImplementation(async () => {
        executionCount++;
        return {
          description: 'Task',
          command: 'cmd',
          output: 'success',
          errors: '',
          result: ExecutionResult.Success,
        };
      });

      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first' },
          { description: 'Second', command: 'second' },
          { description: 'Third', command: 'third' },
        ],
      });

      const onCompleted = vi.fn();
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
        { action: 'Third task', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers({ onCompleted })}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(executionCount).toBe(3);
        },
        { timeout: 1000 }
      );

      // Check that final state has completed = 3
      const calls = vi.mocked(onCompleted).mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall[0].completed).toBe(3);
    });

    it('sets completed correctly on critical failure', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      vi.mocked(executeCommand).mockImplementation(
        async (cmd: { command: string }) => {
          if (cmd.command === 'second') {
            return {
              description: 'Second',
              command: 'second',
              output: '',
              errors: 'Critical error',
              result: ExecutionResult.Error,
            };
          }
          return {
            description: 'Task',
            command: cmd.command,
            output: 'success',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      );

      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first', critical: true },
          { description: 'Second', command: 'second', critical: true },
          { description: 'Third', command: 'third', critical: true },
        ],
      });

      const onCompleted = vi.fn();
      const onError = vi.fn();
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
        { action: 'Third task', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({
            onCompleted,
            onError,
          })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Check that completed = 2 (first task completed, second failed)
      const calls = vi.mocked(onCompleted).mock.calls;
      const errorCall = calls.find(
        (call) => call[0].error && call[0].error !== null
      );
      expect(errorCall).toBeDefined();
      expect(errorCall![0].completed).toBe(2);
    });

    it('sets completed correctly on non-critical failure', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      vi.mocked(executeCommand).mockImplementation(
        async (cmd: { command: string }) => {
          if (cmd.command === 'second') {
            return {
              description: 'Second',
              command: 'second',
              output: '',
              errors: 'Non-critical error',
              result: ExecutionResult.Error,
            };
          }
          return {
            description: 'Task',
            command: cmd.command,
            output: 'success',
            errors: '',
            result: ExecutionResult.Success,
          };
        }
      );

      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first', critical: true },
          { description: 'Second', command: 'second', critical: false },
          { description: 'Third', command: 'third', critical: true },
        ],
      });

      const onCompleted = vi.fn();
      const completeActive = vi.fn();
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
        { action: 'Third task', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers({ onCompleted })}
          lifecycleHandlers={createLifecycleHandlers({ completeActive })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(completeActive).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Check that completed = 3 (all tasks attempted)
      const calls = vi.mocked(onCompleted).mock.calls;
      const finalCall = calls[calls.length - 1];
      expect(finalCall[0].completed).toBe(3);
    });

    it('preserves completed when aborting', async () => {
      const { executeCommand } = await import('../../src/services/shell.js');

      vi.mocked(executeCommand).mockImplementation(async () => {
        // Simulate slow execution
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          description: 'Task',
          command: 'cmd',
          output: 'success',
          errors: '',
          result: ExecutionResult.Success,
        };
      });

      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [
          { description: 'First', command: 'first' },
          { description: 'Second', command: 'second' },
          { description: 'Third', command: 'third' },
        ],
      });

      const onCompleted = vi.fn();
      const onAborted = vi.fn();
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
        { action: 'Third task', type: TaskType.Execute },
      ];

      const { stdin, lastFrame } = render(
        <Execute
          tasks={tasks}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({
            onCompleted,
            onAborted,
          })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      // Wait for first task to complete and second to start
      await vi.waitFor(
        () => {
          return (
            lastFrame()?.includes('First') || lastFrame()?.includes('Running')
          );
        },
        { timeout: 500 }
      );

      // Abort during execution
      stdin.write('\x1b'); // Escape

      await vi.waitFor(
        () => {
          expect(onAborted).toHaveBeenCalledWith('execution');
        },
        { timeout: 500 }
      );

      // Check that completed is set in the abort call
      const calls = vi.mocked(onCompleted).mock.calls;
      const abortCall = calls.find((call) => call[0].taskInfos !== undefined);
      expect(abortCall).toBeDefined();
      expect(abortCall![0]).toHaveProperty('completed');
    });

    it('includes completed in state updates', async () => {
      const service = createMockAnthropicService({
        message: 'Running tasks.',
        commands: [{ description: 'Task', command: 'cmd' }],
      });

      const onCompleted = vi.fn();
      const tasks = [{ action: 'Single task', type: TaskType.Execute }];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers({ onCompleted })}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.advanceTimersByTimeAsync(1000);

      await vi.waitFor(
        () => {
          expect(onCompleted).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );

      // Check that at least one state update includes completed
      const calls = vi.mocked(onCompleted).mock.calls;
      const hasCompleted = calls.some(
        (call) => call[0].completed !== undefined
      );
      expect(hasCompleted).toBe(true);
    });

    it('restores completed from state when resuming', () => {
      const tasks = [
        { action: 'First task', type: TaskType.Execute },
        { action: 'Second task', type: TaskType.Execute },
      ];

      const { lastFrame } = render(
        <ExecuteView
          tasks={tasks}
          state={{
            error: null,
            message: 'Running tasks.',
            summary: '',
            completed: 2,
            taskInfos: [
              {
                label: 'First task',
                command: { description: 'First', command: 'first' },
              },
              {
                label: 'Second task',
                command: { description: 'Second', command: 'second' },
              },
            ],
            taskExecutionTimes: [100, 150],
            completionMessage: 'Tasks completed in 250ms.',
          }}
          status={ComponentStatus.Done}
        />
      );

      // Should render with the restored state
      const frame = lastFrame();
      expect(frame).toContain('Tasks completed');
    });
  });

  describe('Complete state preservation', () => {
    it('preserves all state fields after successful execution', async () => {
      const service = createMockAnthropicService({
        message: 'Processing tasks',
        summary: 'Task summary',
        commands: [
          { description: 'First task', command: 'cmd1' },
          { description: 'Second task', command: 'cmd2' },
        ],
      });

      const onCompleted = vi.fn();
      const tasks = [
        { action: 'First', type: TaskType.Execute },
        { action: 'Second', type: TaskType.Execute },
      ];

      render(
        <Execute
          tasks={tasks}
          service={service}
          requestHandlers={createRequestHandlers({ onCompleted })}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.advanceTimersByTimeAsync(500);

      // Wait for completion
      await vi.waitFor(
        () => {
          const calls = onCompleted.mock.calls;
          return calls.some((call) => call[0].completionMessage !== undefined);
        },
        { timeout: 500 }
      );

      // Find the final completion state update
      const calls = onCompleted.mock.calls;
      const completionCall = calls.find(
        (call) => call[0].completionMessage !== null
      );

      expect(completionCall).toBeDefined();
      expect(completionCall![0]).toMatchObject({
        message: expect.any(String),
        summary: expect.any(String),
        taskInfos: expect.any(Array),
        completed: expect.any(Number),
        taskExecutionTimes: expect.any(Array),
        completionMessage: expect.any(String),
        error: null,
      });
    });

    it('preserves all state fields on abort', async () => {
      const service = createMockAnthropicService({
        message: 'Executing tasks',
        summary: 'Summary text',
        commands: [
          { description: 'Task 1', command: 'cmd1' },
          { description: 'Task 2', command: 'cmd2' },
        ],
      });

      const onCompleted = vi.fn();
      const onAborted = vi.fn();

      const { stdin } = render(
        <Execute
          tasks={[
            { action: 'First', type: TaskType.Execute },
            { action: 'Second', type: TaskType.Execute },
          ]}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({
            onCompleted,
            onAborted,
          })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.advanceTimersByTimeAsync(50);

      // Press escape to abort
      stdin.write('\x1b');

      await vi.waitFor(
        () => {
          expect(onAborted).toHaveBeenCalledWith('execution');
        },
        { timeout: 200 }
      );

      // Find the abort state update
      const calls = onCompleted.mock.calls;
      const abortCall = calls[calls.length - 1];

      expect(abortCall[0]).toMatchObject({
        message: expect.any(String),
        summary: expect.any(String),
        taskInfos: expect.any(Array),
        completed: expect.any(Number),
        taskExecutionTimes: expect.any(Array),
        completionMessage: null,
        error: null,
      });
    });

    it('preserves all state fields on error', async () => {
      const service = createMockAnthropicService(
        {},
        new Error('Processing failed')
      );

      const onCompleted = vi.fn();
      const onError = vi.fn();

      render(
        <Execute
          tasks={[{ action: 'Task', type: TaskType.Execute }]}
          service={service}
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={createRequestHandlers({ onCompleted, onError })}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalled();
        },
        { timeout: 200 }
      );

      // Find the error state update
      const calls = onCompleted.mock.calls;
      const errorCall = calls.find((call) => call[0].error !== null);

      expect(errorCall).toBeDefined();
      expect(errorCall![0]).toMatchObject({
        message: '',
        summary: '',
        taskInfos: [],
        completed: 0,
        taskExecutionTimes: [],
        completionMessage: null,
        error: expect.any(String),
      });
    });
  });
});
