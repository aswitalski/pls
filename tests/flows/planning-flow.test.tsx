import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../src/configuration/types.js';
import { App, TaskType } from '../../src/types/types.js';

import { loadConfig } from '../../src/configuration/io.js';
import { getMissingConfigKeys } from '../../src/configuration/schema.js';
import { exitApp } from '../../src/services/process.js';

import { Main } from '../../src/ui/Main.js';

import { Keys } from '../test-utils.js';

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

const ShortWait = 50;
const WorkflowWait = 100;

describe('Planning flow', () => {
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

  describe('Command processing', () => {
    it('processes command and creates plan', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks.',
          tasks: [{ action: 'Install dependencies', type: TaskType.Execute }],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(
        <Main app={mockApp} command="install deps" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('Install dependencies');

      vi.restoreAllMocks();
    });

    it('shows confirmation for concrete tasks', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');
      const messagesModule = await import('../../src/services/messages.js');

      vi.spyOn(messagesModule, 'getConfirmationMessage').mockReturnValue(
        'Confirm execution?'
      );

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks.',
          tasks: [{ action: 'Run tests', type: TaskType.Execute }],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(<Main app={mockApp} command="run tests" />);

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('Confirm execution?');

      vi.restoreAllMocks();
    });
  });

  describe('Task type transformation', () => {
    it('transforms natural language to Execute tasks', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks.',
          tasks: [
            { action: 'Build the project', type: TaskType.Execute },
            { action: 'Run tests', type: TaskType.Execute },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(
        <Main app={mockApp} command="build and test" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('Build the project');
      expect(output).toContain('Run tests');

      vi.restoreAllMocks();
    });

    it('creates Introspect tasks for capability queries', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Here are my capabilities:',
          tasks: [
            {
              action: 'List available capabilities',
              type: TaskType.Introspect,
            },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(
        <Main app={mockApp} command="list your skills" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('List available capabilities');

      vi.restoreAllMocks();
    });

    it('creates Answer tasks for information queries', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: "I'll answer your question.",
          tasks: [
            { action: 'Explain Docker containers', type: TaskType.Answer },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(
        <Main app={mockApp} command="what are docker containers" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('Explain Docker containers');

      vi.restoreAllMocks();
    });

    it('creates Define tasks for ambiguous requests', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Choose an option:',
          tasks: [
            {
              action: 'Select environment',
              type: TaskType.Define,
              params: {
                options: ['Development', 'Production', 'Staging'],
              },
            },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(<Main app={mockApp} command="deploy" />);

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('Select environment');
      expect(output).toContain('Development');
      expect(output).toContain('Production');
      expect(output).toContain('Staging');

      vi.restoreAllMocks();
    });
  });

  describe('Plan selection and refinement', () => {
    it('allows user to navigate Define task options', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Choose an option:',
          tasks: [
            {
              action: 'Select environment',
              type: TaskType.Define,
              params: {
                options: ['Development', 'Production', 'Staging'],
              },
            },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="deploy" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      let output = lastFrame();
      expect(output).toContain('Select environment');
      expect(output).toContain('Development');
      expect(output).toContain('Production');
      expect(output).toContain('Staging');

      stdin.write(Keys.ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      output = lastFrame();
      expect(output).toContain('Production');

      vi.restoreAllMocks();
    });

    it('shows refinement message during plan refinement', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      let callCount = 0;
      const mockService = {
        processWithTool: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              message: 'Choose an option:',
              tasks: [
                {
                  action: 'Select target',
                  type: TaskType.Define,
                  params: { options: ['Option A', 'Option B'] },
                },
              ],
            });
          } else {
            return Promise.resolve({
              message: 'Refined plan.',
              tasks: [{ action: 'Execute Option A', type: TaskType.Execute }],
            });
          }
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { stdin } = render(<Main app={mockApp} command="test" />);

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      stdin.write(Keys.Enter);

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      vi.restoreAllMocks();
    });
  });
});
