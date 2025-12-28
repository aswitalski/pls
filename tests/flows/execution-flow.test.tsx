import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../src/configuration/types.js';
import { App, TaskType } from '../../src/types/types.js';

import { loadConfig } from '../../src/configuration/io.js';
import { getMissingConfigKeys } from '../../src/configuration/schema.js';
import { exitApp } from '../../src/services/process.js';

import { Main } from '../../src/ui/Main.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
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

const WorkflowWait = 200;

describe('Task execution flows', () => {
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

  describe('Introspection flow', () => {
    it('routes introspect tasks to Introspect component', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');
      const messagesModule = await import('../../src/services/messages.js');

      vi.spyOn(messagesModule, 'getConfirmationMessage').mockReturnValue(
        'Confirm?'
      );

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Here are my capabilities:',
          tasks: [
            {
              action: 'PLAN: Break down requests',
              type: TaskType.Introspect,
            },
            { action: 'EXECUTE: Run commands', type: TaskType.Introspect },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(
        <Main app={mockApp} command="list skills" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      expect(output).toContain('PLAN: Break down requests');
      expect(output).toContain('EXECUTE: Run commands');

      vi.restoreAllMocks();
    });
  });
});
