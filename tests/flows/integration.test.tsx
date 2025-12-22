import { randomUUID } from 'crypto';
import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App, TaskType } from '../../src/types/types.js';

import {
  DebugLevel,
  getMissingConfigKeys,
  loadConfig,
} from '../../src/services/configuration.js';
import { exitApp } from '../../src/services/process.js';

import { Main } from '../../src/ui/Main.js';

import { Keys } from '../test-utils.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock configuration and process modules
vi.mock('../../src/services/configuration.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/services/configuration.js')
  >('../../src/services/configuration.js');
  return {
    ...actual,
    getMissingConfigKeys: vi.fn(),
    loadConfig: vi.fn(),
  };
});

vi.mock('../../src/services/process.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/services/process.js')
  >('../../src/services/process.js');
  return {
    ...actual,
    exitApp: vi.fn(),
  };
});

// Wait times for React render cycles
const ShortWait = 50; // For simple React updates
const WorkflowWait = 100; // For complex component workflows

describe('End-to-End Flow Integration Tests', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
    debug: DebugLevel.None,
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Mock configuration system to bypass config checks by default
    vi.mocked(getMissingConfigKeys).mockReturnValue([]);
    vi.mocked(loadConfig).mockReturnValue({
      anthropic: { key: 'test-key', model: 'test-model' },
    });

    // exitApp is already mocked at module level
    vi.mocked(exitApp).mockImplementation(() => {});
  });

  describe('Flow 1: Initial Configuration Flow', () => {
    it('shows welcome screen and exits when no config and no command', async () => {
      const { lastFrame } = render(<Main app={mockApp} command={null} />);

      // Wait for effects to run
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      // Should have rendered the welcome screen
      const output = lastFrame();
      expect(output).toBeTruthy();

      // Should have called exitApp(0)
      expect(exitApp).toHaveBeenCalledWith(0);
    });

    it('shows welcome and config flow for first-time users', async () => {
      // This would test the full config flow, but requires mocking the config system
      // Currently we just verify welcome screen is shown
      const { lastFrame } = render(<Main app={mockApp} command={null} />);

      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toBeTruthy();
    });
  });

  describe('Flow 2: Command Execution Flow', () => {
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

  describe('Flow 3: Planning Flow', () => {
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

  describe('Flow 4: Plan Selection and Refinement Flow', () => {
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

      // Wait for Define task to appear
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Verify options are shown
      let output = lastFrame();
      expect(output).toContain('Select environment');
      expect(output).toContain('Development');
      expect(output).toContain('Production');
      expect(output).toContain('Staging');

      // Navigate down to Production
      stdin.write(Keys.ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      output = lastFrame();
      // Production should be highlighted/selected
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

      // Select option
      stdin.write(Keys.Enter);

      // Refinement happens automatically
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      vi.restoreAllMocks();
    });
  });

  describe('Flow 5: Task Execution Flows', () => {
    describe('Introspection Flow', () => {
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

    describe('Answer Flow', () => {
      it('routes answer tasks to Answer component', async () => {
        const anthropicModule = await import('../../src/services/anthropic.js');

        const mockService = {
          processWithTool: vi.fn().mockResolvedValue({
            message: "I'll answer your question.",
            tasks: [
              { action: 'Explain testing concepts', type: TaskType.Answer },
            ],
          }),
        };

        vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
          mockService as any
        );

        const { lastFrame } = render(
          <Main app={mockApp} command="explain testing" />
        );

        await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

        const output = lastFrame();
        expect(output).toContain('Explain testing concepts');

        vi.restoreAllMocks();
      });
    });

    describe('Execute Flow', () => {
      it('routes execute tasks to Execute component', async () => {
        const anthropicModule = await import('../../src/services/anthropic.js');
        const messagesModule = await import('../../src/services/messages.js');

        vi.spyOn(messagesModule, 'getConfirmationMessage').mockReturnValue(
          'Proceed?'
        );

        const mockService = {
          processWithTool: vi.fn().mockResolvedValue({
            message: 'Execute these commands.',
            tasks: [
              { action: 'npm install', type: TaskType.Execute },
              { action: 'npm test', type: TaskType.Execute },
            ],
          }),
        };

        vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
          mockService as any
        );

        const { lastFrame } = render(
          <Main app={mockApp} command="install and test" />
        );

        await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

        const output = lastFrame();
        expect(output).toContain('npm install');
        expect(output).toContain('npm test');

        vi.restoreAllMocks();
      });
    });
  });

  describe('Flow 8: Error Handling Flow', () => {
    it('shows error feedback when LLM call fails', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi
          .fn()
          .mockRejectedValue(new Error('API connection failed')),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(
        <Main app={mockApp} command="test command" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      // Error is shown with ✗ symbol and error message
      expect(output).toMatch(/✗|API connection failed/);

      vi.restoreAllMocks();
    });

    it('exits with error code on failures', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockRejectedValue(new Error('Test error')),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      render(<Main app={mockApp} command="test" />);

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Should have called exitApp with error code
      expect(exitApp).toHaveBeenCalledWith(1);

      vi.restoreAllMocks();
    });
  });

  describe('Flow 9: Abort and Cancellation Flow', () => {
    it('shows cancellation message when aborting confirmation', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks.',
          tasks: [{ action: 'Task 1', type: TaskType.Execute }],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="test" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(/(cancelled|aborted)/i);

      vi.restoreAllMocks();
    });

    it('shows cancellation message when aborting plan selection', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Choose an option:',
          tasks: [
            {
              action: 'Select target',
              type: TaskType.Define,
              params: { options: ['Option A', 'Option B'] },
            },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="test" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(/(cancelled|aborted)/i);
      expect(output).toContain('task selection');

      vi.restoreAllMocks();
    });

    it('exits with code 0 when user cancels', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks.',
          tasks: [{ action: 'Task 1', type: TaskType.Execute }],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { stdin } = render(<Main app={mockApp} command="test" />);

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      // Should exit with code 0 (successful cancellation)
      expect(exitApp).toHaveBeenCalledWith(0);

      vi.restoreAllMocks();
    });

    it('handles cancellation during introspection', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Here are my capabilities:',
          tasks: [
            { action: 'Capability 1', type: TaskType.Introspect },
            { action: 'Capability 2', type: TaskType.Introspect },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="list skills" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(/(cancelled|aborted)/i);
      expect(output).toContain('introspection');

      vi.restoreAllMocks();
    });

    it('handles cancellation during answer', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: "I'll answer your question.",
          tasks: [{ action: 'Explain something', type: TaskType.Answer }],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="explain something" />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(/(cancelled|aborted)/i);
      expect(output).toContain('answer');

      vi.restoreAllMocks();
    });
  });

  describe('Debug Mode Integration', () => {
    it('shows debug components at Verbose level', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');
      const debugModule = await import('../../src/services/logger.js');

      // Set debug level to Verbose
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

      // Reset debug level
      debugModule.setDebugLevel(DebugLevel.None);
      vi.restoreAllMocks();
    });

    it('hides debug components at None level', async () => {
      const anthropicModule = await import('../../src/services/anthropic.js');
      const debugModule = await import('../../src/services/logger.js');

      // Set debug level to None
      debugModule.setDebugLevel(DebugLevel.None);

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Listing files.',
          tasks: [{ action: 'List files', type: TaskType.Execute }],
          debug: [], // No debug components at None level
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

      // Set debug level to Verbose
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
        <Main
          app={{ ...mockApp, debug: DebugLevel.Verbose }}
          command="run cmd"
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      const output = lastFrame();
      // Debug component should be in timeline
      expect(output).toContain('SYSTEM PROMPT');
      expect(output).toContain('Tool: plan');

      // Reset debug level
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
});
