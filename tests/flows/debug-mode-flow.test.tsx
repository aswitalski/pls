import { randomUUID } from 'crypto';
import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../src/configuration/types.js';
import { App, TaskType } from '../../src/types/types.js';

import { loadConfig } from '../../src/configuration/io.js';
import { getMissingConfigKeys } from '../../src/configuration/schema.js';
import { exitApp } from '../../src/services/process.js';

import { Main } from '../../src/Main.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ELAPSED_UPDATE_INTERVAL: 250,
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock configuration modules
vi.mock('../../src/configuration/schema.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/configuration/schema.js')
  >('../../src/configuration/schema.js');
  return {
    ...actual,
    getMissingConfigKeys: vi.fn(),
  };
});

vi.mock('../../src/configuration/io.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/configuration/io.js')
  >('../../src/configuration/io.js');
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

// Mock process module
vi.mock('../../src/services/process.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/services/process.js')
  >('../../src/services/process.js');
  return {
    ...actual,
    exitApp: vi.fn(),
  };
});

const WorkflowWait = 100;

describe('Debug mode integration', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
    debug: DebugLevel.None,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMissingConfigKeys).mockReturnValue([]);
    vi.mocked(loadConfig).mockReturnValue({
      anthropic: { key: 'test-key', model: 'test-model' },
    });
    vi.mocked(exitApp).mockImplementation(() => {});
  });

  it('shows debug components at Verbose level', async () => {
    const anthropicModule = await import('../../src/services/anthropic.js');
    const debugModule = await import('../../src/services/logger.js');

    debugModule.setDebugLevel(DebugLevel.Verbose);

    const mockService = {
      processWithTool: vi.fn().mockImplementation(() =>
        Promise.resolve({
          message: 'Creating file.',
          tasks: [{ action: 'Create test.txt', type: TaskType.Execute }],
          debug: [
            {
              id: randomUUID(),
              name: 'debug' as const,
              props: {
                title: 'SYSTEM PROMPT',
                content: 'Tool: plan\nCommand: create file',
                color: '#ffffff',
              },
            },
            {
              id: randomUUID(),
              name: 'debug' as const,
              props: {
                title: 'LLM RESPONSE',
                content: 'Response: {"message": "Creating file."}',
                color: '#ffffff',
              },
            },
          ],
        })
      ),
    };

    vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
      mockService as any
    );

    const { lastFrame } = render(
      <Main
        app={{ ...mockApp, debug: DebugLevel.Verbose }}
        command="create file"
      />
    );

    await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

    const output = lastFrame();
    expect(output).toContain('SYSTEM PROMPT');
    expect(output).toContain('LLM RESPONSE');
    expect(output).toContain('Tool: plan');

    debugModule.setDebugLevel(DebugLevel.None);
    vi.restoreAllMocks();
  });

  it('hides debug components at None level', async () => {
    const anthropicModule = await import('../../src/services/anthropic.js');
    const debugModule = await import('../../src/services/logger.js');

    debugModule.setDebugLevel(DebugLevel.None);

    const mockService = {
      processWithTool: vi.fn().mockResolvedValue({
        message: 'Listing files.',
        tasks: [{ action: 'List files', type: TaskType.Execute }],
        debug: [],
      }),
    };

    vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
      mockService as any
    );

    const { lastFrame } = render(<Main app={mockApp} command="list files" />);

    await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

    const output = lastFrame();
    expect(output).not.toContain('SYSTEM PROMPT');
    expect(output).not.toContain('LLM RESPONSE');
    expect(output).toContain('List files');

    vi.restoreAllMocks();
  });

  it('preserves debug components in timeline', async () => {
    const anthropicModule = await import('../../src/services/anthropic.js');
    const debugModule = await import('../../src/services/logger.js');

    debugModule.setDebugLevel(DebugLevel.Verbose);

    const mockService = {
      processWithTool: vi.fn().mockImplementation(() =>
        Promise.resolve({
          message: 'Task planned.',
          tasks: [{ action: 'Run command', type: TaskType.Execute }],
          debug: [
            {
              id: randomUUID(),
              name: 'debug' as const,
              props: {
                title: 'SYSTEM PROMPT',
                content: 'Tool: plan\nCommand: run cmd',
                color: '#ffffff',
              },
            },
          ],
        })
      ),
    };

    vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
      mockService as any
    );

    const { lastFrame } = render(
      <Main app={{ ...mockApp, debug: DebugLevel.Verbose }} command="run cmd" />
    );

    await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

    const output = lastFrame();
    expect(output).toContain('SYSTEM PROMPT');
    expect(output).toContain('Tool: plan');

    debugModule.setDebugLevel(DebugLevel.None);
    vi.restoreAllMocks();
  });

  it('handles multiple debug components in sequence', async () => {
    const anthropicModule = await import('../../src/services/anthropic.js');
    const debugModule = await import('../../src/services/logger.js');

    debugModule.setDebugLevel(DebugLevel.Verbose);

    const mockService = {
      processWithTool: vi.fn().mockImplementation(() =>
        Promise.resolve({
          message: 'Processing.',
          tasks: [{ action: 'Process data', type: TaskType.Execute }],
          debug: [
            {
              id: randomUUID(),
              name: 'debug' as const,
              props: {
                title: 'SYSTEM PROMPT',
                content: 'First prompt',
                color: '#ffffff',
              },
            },
            {
              id: randomUUID(),
              name: 'debug' as const,
              props: {
                title: 'LLM RESPONSE',
                content: 'First response',
                color: '#ffffff',
              },
            },
            {
              id: randomUUID(),
              name: 'debug' as const,
              props: {
                title: 'SYSTEM PROMPT',
                content: 'Second prompt',
                color: '#ffffff',
              },
            },
          ],
        })
      ),
    };

    vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
      mockService as any
    );

    const { lastFrame } = render(
      <Main
        app={{ ...mockApp, debug: DebugLevel.Verbose }}
        command="process data"
      />
    );

    await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

    const output = lastFrame();
    expect(output).toContain('First prompt');
    expect(output).toContain('First response');
    expect(output).toContain('Second prompt');

    debugModule.setDebugLevel(DebugLevel.None);
    vi.restoreAllMocks();
  });

  it('shows debug boxes for all tool types', async () => {
    const anthropicModule = await import('../../src/services/anthropic.js');
    const debugModule = await import('../../src/services/logger.js');

    debugModule.setDebugLevel(DebugLevel.Verbose);

    const mockService = {
      processWithTool: vi.fn().mockResolvedValue({
        message: 'Processing tasks.',
        tasks: [
          { action: 'Execute command', type: TaskType.Execute },
          { action: 'Answer question', type: TaskType.Answer },
          { action: 'Show capabilities', type: TaskType.Introspect },
        ],
        debug: [
          {
            id: randomUUID(),
            name: 'debug' as const,
            props: {
              title: 'SYSTEM PROMPT',
              content: 'Tool: schedule',
              color: '#ffffff',
            },
          },
          {
            id: randomUUID(),
            name: 'debug' as const,
            props: {
              title: 'LLM RESPONSE',
              content: 'Response with mixed tasks',
              color: '#ffffff',
            },
          },
        ],
      }),
    };

    vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
      mockService as any
    );

    const { lastFrame } = render(
      <Main
        app={{ ...mockApp, debug: DebugLevel.Verbose }}
        command="do multiple things"
      />
    );

    await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

    const output = lastFrame();
    expect(output).toContain('SYSTEM PROMPT');
    expect(output).toContain('LLM RESPONSE');

    debugModule.setDebugLevel(DebugLevel.None);
    vi.restoreAllMocks();
  });
});
