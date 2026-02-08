import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentStatus,
  DiscoverState,
} from '../../../src/types/components.js';

import { Discover } from '../../../src/components/controllers/Discover.js';

import {
  Keys,
  createLifecycleHandlers,
  createMockAnthropicService,
  createRequestHandlers,
  createWorkflowHandlers,
} from '../../test-utils.js';

const { Escape } = Keys;

// Mock timing helpers to skip delays in tests
vi.mock('../../../src/services/timing.js', () => ({
  ELAPSED_UPDATE_INTERVAL: 250,
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock RealExecutor to avoid spawning real processes
vi.mock('../../../src/services/shell.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/services/shell.js')>();
  return {
    ...actual,
    RealExecutor: class MockExecutor {
      async execute() {
        return {
          output: 'file1.ts\nfile2.ts\nfile3.ts',
          errors: '',
          exitCode: 0,
        };
      }
    },
  };
});

// Mock system context to avoid OS-specific output
vi.mock('../../../src/services/system.js', () => ({
  formatSystemContext: vi
    .fn()
    .mockReturnValue(
      '  - accepted schedule: "Find TypeScript files"\n' +
        '  - operating system: macOS 15.0\n' +
        '  - shell: zsh'
    ),
}));

describe('Discover component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls discover tool with query and system context', async () => {
    const service = createMockAnthropicService({
      message: 'Search for TypeScript files.',
      command: {
        description: 'Find .ts files',
        command: "find . -name '*.ts'",
      },
    });
    const spy = vi.spyOn(service, 'processWithTool');

    render(
      <Discover
        query="find ts files"
        action="Find TypeScript files"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers<DiscoverState>()}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    await vi.waitFor(
      () => {
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('find ts files'),
          'discover'
        );
      },
      { timeout: 500 }
    );
  });

  it('completes lifecycle after successful discovery and execution', async () => {
    const service = createMockAnthropicService({
      message: 'Search for TypeScript files.',
      command: {
        description: 'Find .ts files',
        command: "find . -name '*.ts'",
      },
    });
    const completeActive = vi.fn();
    const lifecycleHandlers = createLifecycleHandlers({ completeActive });

    render(
      <Discover
        query="find ts files"
        action="Find TypeScript files"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers<DiscoverState>()}
        lifecycleHandlers={lifecycleHandlers}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    await vi.waitFor(
      () => {
        expect(completeActive).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('calls onError when discovery fails', async () => {
    const service = createMockAnthropicService(
      {},
      new Error('API connection failed')
    );
    const onError = vi.fn();

    render(
      <Discover
        query="find ts files"
        action="Find TypeScript files"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers({ onError })}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    await vi.waitFor(
      () => {
        expect(onError).toHaveBeenCalledWith('API connection failed');
      },
      { timeout: 500 }
    );
  });

  it('handles escape key to abort', () => {
    const service = createMockAnthropicService({
      message: 'Search for files.',
      command: {
        description: 'Find files',
        command: 'find . -type f',
      },
    });
    const onAborted = vi.fn();

    const { stdin } = render(
      <Discover
        query="find files"
        action="Find files"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers({ onAborted })}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    stdin.write(Escape);

    expect(onAborted).toHaveBeenCalledWith('discover');
  });

  it('adds debug components to timeline', async () => {
    const service = createMockAnthropicService({
      message: 'Search for files.',
      command: {
        description: 'Find files',
        command: 'find . -type f',
      },
      debug: [
        {
          id: 'debug-discover',
          name: 'debug' as never,
          status: ComponentStatus.Done,
          props: { title: 'DEBUG', content: 'test', color: '#fff' },
        },
      ],
    });

    const workflowHandlers = createWorkflowHandlers();

    render(
      <Discover
        query="find files"
        action="Find files"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers<DiscoverState>()}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={workflowHandlers}
      />
    );

    await vi.waitFor(
      () => {
        expect(workflowHandlers.addToTimeline).toHaveBeenCalled();
      },
      { timeout: 500 }
    );
  });

  it('does not process when status is Done', () => {
    const service = createMockAnthropicService({
      message: 'Search for files.',
      command: {
        description: 'Find files',
        command: 'find . -type f',
      },
    });
    const spy = vi.spyOn(service, 'processWithTool');

    render(
      <Discover
        query="find files"
        action="Find files"
        service={service}
        status={ComponentStatus.Done}
        requestHandlers={createRequestHandlers<DiscoverState>()}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    expect(spy).not.toHaveBeenCalled();
  });
});
