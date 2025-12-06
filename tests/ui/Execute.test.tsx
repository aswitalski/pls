import { ComponentStatus } from '../../src/types/components.js';
import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskType } from '../../src/types/types.js';

import { Execute } from '../../src/ui/Execute.js';

import {
  createMockAnthropicService,
  createMockHandlers,
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
vi.mock('../../src/services/config-loader.js', () => ({
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
              result: 'success',
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
        handlers={createMockHandlers()}
        status={ComponentStatus.Active}
      />
    );

    expect(lastFrame()).toContain('Preparing commands.');
  });

  it('returns null when done with no commands', async () => {
    const service = createMockAnthropicService({
      message: '',
      commands: [],
    });

    const tasks = [{ action: 'Test', type: TaskType.Execute }];

    const { lastFrame } = render(
      <Execute
        tasks={tasks}
        state={{}}
        service={service}
        handlers={createMockHandlers()}
        status={ComponentStatus.Active}
      />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toBe('');
    });
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
        handlers={createMockHandlers({ completeActive })}
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
        handlers={createMockHandlers({ onError })}
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
        handlers={createMockHandlers({ onAborted })}
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
        handlers={createMockHandlers({ onAborted })}
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
        handlers={createMockHandlers({ onAborted })}
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
        handlers={createMockHandlers({ completeActive })}
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

  it('resolves placeholders in commands before execution', async () => {
    const { executeCommands } = await import('../../src/services/shell.js');

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
        handlers={createMockHandlers()}
        status={ComponentStatus.Active}
      />
    );

    await vi.waitFor(
      () => {
        expect(executeCommands).toHaveBeenCalled();
      },
      { timeout: 500 }
    );

    // Verify that executeCommands was called with resolved placeholders
    const commandsArg = (executeCommands as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(commandsArg[0].command).toBe('cd /home/user/alpha');
  });

  it('keeps unresolved placeholders if not in config', async () => {
    const { executeCommands } = await import('../../src/services/shell.js');

    const service = createMockAnthropicService({
      message: 'Running command.',
      commands: [
        {
          description: 'Navigate to unknown path',
          command: 'cd {project.gamma.path}',
        },
      ],
    });

    const tasks = [
      {
        action: 'Navigate to Gamma project directory',
        type: TaskType.Execute,
      },
    ];

    render(
      <Execute
        tasks={tasks}
        service={service}
        handlers={createMockHandlers()}
        status={ComponentStatus.Active}
      />
    );

    await vi.waitFor(
      () => {
        expect(executeCommands).toHaveBeenCalled();
      },
      { timeout: 500 }
    );

    // Verify that unresolved placeholders are kept as-is
    const commandsArg = (executeCommands as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(commandsArg[0].command).toBe('cd {project.gamma.path}');
  });
});
