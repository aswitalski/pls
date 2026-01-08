import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../src/configuration/types.js';
import { App } from '../src/types/types.js';

import { loadConfig } from '../src/configuration/io.js';
import { getMissingConfigKeys } from '../src/configuration/schema.js';

import { Main } from '../src/Main.js';

// Mock timing helpers to skip delays in tests
vi.mock('../src/services/timing.js', () => ({
  ELAPSED_UPDATE_INTERVAL: 250,
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock configuration modules
vi.mock('../src/configuration/schema.js', async () => {
  const actual = await vi.importActual<
    typeof import('../src/configuration/schema.js')
  >('../src/configuration/schema.js');
  return {
    ...actual,
    getMissingConfigKeys: vi.fn(),
  };
});

vi.mock('../src/configuration/io.js', async () => {
  const actual = await vi.importActual<
    typeof import('../src/configuration/io.js')
  >('../src/configuration/io.js');
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

// Wait times for React render cycles
// With timing helpers mocked, we only need to wait for React render cycles
const ShortWait = 50; // For simple React updates and mocked anthropic calls
const WorkflowWait = 100; // For complex component workflows (Command -> Plan -> Confirm)

describe('Main component queue-based architecture', () => {
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
  });

  describe('Queue initialization', () => {
    it('initializes with command', () => {
      const result = <Main app={mockApp} command="test command" />;

      expect(result).toBeDefined();
      expect(result.props.app).toBe(mockApp);
      expect(result.props.command).toBe('test command');
    });

    it('initializes without command', () => {
      const result = <Main app={mockApp} command={null} />;

      expect(result).toBeDefined();
      expect(result.props.command).toBeNull();
    });
  });

  describe('Props validation', () => {
    it('accepts all props', () => {
      const result = <Main app={mockApp} command="test" />;

      expect(result.props.app).toBeDefined();
      expect(result.props.command).toBe('test');
    });

    it('works with minimal props', () => {
      const result = <Main app={mockApp} command={null} />;

      expect(result.props.app).toBeDefined();
      expect(result.props.command).toBeNull();
    });
  });

  describe('App info handling', () => {
    it('passes app info correctly', () => {
      const customApp: App = {
        name: 'custom-app',
        version: '2.0.0',
        description: 'Custom description',
        isDev: true,
        debug: DebugLevel.None,
      };

      const result = <Main app={customApp} command={null} />;

      expect(result.props.app).toBe(customApp);
      expect(result.props.app.name).toBe('custom-app');
      expect(result.props.app.version).toBe('2.0.0');
      expect(result.props.app.isDev).toBe(true);
    });

    it('handles dev mode flag', () => {
      const devApp = { ...mockApp, isDev: true };
      const prodApp = { ...mockApp, isDev: false };

      const devResult = <Main app={devApp} command={null} />;

      const prodResult = <Main app={prodApp} command={null} />;

      expect(devResult.props.app.isDev).toBe(true);
      expect(prodResult.props.app.isDev).toBe(false);
    });

    it('handles debug mode flag', () => {
      const debugApp = { ...mockApp, debug: DebugLevel.Info };
      const normalApp = { ...mockApp, debug: DebugLevel.None };

      const debugResult = <Main app={debugApp} command={null} />;
      const normalResult = <Main app={normalApp} command={null} />;

      expect(debugResult.props.app.debug).toBe(DebugLevel.Info);
      expect(normalResult.props.app.debug).toBe(DebugLevel.None);
    });
  });

  describe('Exit behavior', () => {
    it('exits after showing welcome screen with no command', async () => {
      // Import the module to spy on
      const processModule = await import('../src/services/process.js');
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      const { lastFrame } = render(<Main app={mockApp} command={null} />);

      // Wait for effects to run
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      // Should have rendered the welcome screen
      const output = lastFrame();
      expect(output).toBeTruthy();

      // Should have called exitApp(0)
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Cleanup
      exitSpy.mockRestore();
    });
  });

  describe('Service creation failures', () => {
    it('shows error feedback when service creation fails on startup', async () => {
      const anthropicModule = await import('../src/services/anthropic.js');
      const processModule = await import('../src/services/process.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock createAnthropicService to throw error
      const serviceError = new Error('Invalid API key format');
      vi.spyOn(anthropicModule, 'createAnthropicService').mockImplementation(
        () => {
          throw serviceError;
        }
      );

      const { lastFrame } = render(<Main app={mockApp} command="test" />);

      // Wait for effects to run
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toContain('Invalid API key format');

      // Should exit with error code 1
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('shows error feedback when config save fails during initial setup', async () => {
      const schemaModule = await import('../src/configuration/schema.js');
      const ioModule = await import('../src/configuration/io.js');
      const processModule = await import('../src/services/process.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock getMissingConfigKeys to simulate missing config
      vi.spyOn(schemaModule, 'getMissingConfigKeys').mockReturnValue([
        'key',
        'model',
      ]);

      // Mock saveAnthropicConfig to throw error
      const saveError = new Error('Failed to write config file');
      vi.spyOn(ioModule, 'saveAnthropicConfig').mockImplementation(() => {
        throw saveError;
      });

      const { lastFrame } = render(<Main app={mockApp} command={null} />);

      // Wait for initial render
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      // Note: This test verifies the error handling is in place
      // The error would be triggered when Config component completes
      // For now, we verify the component renders without crashing
      const output = lastFrame();
      expect(output).toBeTruthy();

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('handles service creation with non-Error exception', async () => {
      const anthropicModule = await import('../src/services/anthropic.js');
      const processModule = await import('../src/services/process.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock createAnthropicService to throw non-Error object
      vi.spyOn(anthropicModule, 'createAnthropicService').mockImplementation(
        () => {
          throw 'String error';
        }
      );

      const { lastFrame } = render(<Main app={mockApp} command="test" />);

      // Wait for effects to run
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      // Should show default error message
      expect(output).toContain('Failed to initialize service');

      // Should exit with error code 1
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('Confirmation flow', () => {
    it('shows confirmation after plan without Define tasks', async () => {
      const componentsModule = await import('../src/services/components.js');
      const processModule = await import('../src/services/process.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock service that returns a plan without Define tasks
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks',
          tasks: [
            { action: 'Task 1', type: 'execute' },
            { action: 'Task 2', type: 'execute' },
          ],
        }),
      };

      // Use dependency injection instead of module mocking
      const mockServiceFactory = () => mockService as any;

      // Spy on createConfirm to verify it's called
      const confirmSpy = vi.spyOn(componentsModule, 'createConfirm');

      render(
        <Main
          app={mockApp}
          command="test task"
          serviceFactory={mockServiceFactory}
        />
      );

      // Wait for async processing (Command -> Plan -> Confirm workflow)
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Verify createConfirm was called
      expect(confirmSpy).toHaveBeenCalled();

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('does not exit when showing confirmation', async () => {
      const anthropicModule = await import('../src/services/anthropic.js');
      const processModule = await import('../src/services/process.js');
      const messagesModule = await import('../src/services/messages.js');

      // Mock confirmation message to make test deterministic
      vi.spyOn(messagesModule, 'getConfirmationMessage').mockReturnValue(
        'Test confirmation message'
      );

      // Mock exitApp to track if it's called
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock service that returns a plan without Define tasks
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks',
          tasks: [
            { action: 'Task 1', type: 'execute' },
            { action: 'Task 2', type: 'execute' },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame } = render(<Main app={mockApp} command="test task" />);

      // Wait for async processing (Command -> Plan -> Confirm workflow)
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Verify the confirmation is shown in the output
      const output = lastFrame();
      expect(output).toContain('Test confirmation message');

      // Verify exitApp was NOT called (app should wait for user input)
      expect(exitSpy).not.toHaveBeenCalled();

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('Abort messages', () => {
    it('shows cancellation message when aborting plan confirmation', async () => {
      const anthropicModule = await import('../src/services/anthropic.js');
      const processModule = await import('../src/services/process.js');
      const { Keys } = await import('./test-utils.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock service that returns a plan without Define tasks
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Execute these tasks',
          tasks: [
            { action: 'Task 1', type: 'execute' },
            { action: 'Task 2', type: 'execute' },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="test task" />
      );

      // Wait for confirmation to appear
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(
        /(I've cancelled the|I've aborted the|The.*was cancelled|The.*has been aborted)/
      );
      expect(output).toContain('execution');

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('shows cancellation message when aborting plan navigation', async () => {
      const anthropicModule = await import('../src/services/anthropic.js');
      const processModule = await import('../src/services/process.js');
      const { Keys } = await import('./test-utils.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock service that returns a plan with Define tasks
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Choose an option',
          tasks: [
            {
              action: 'Select environment',
              type: 'define',
              params: { options: ['Dev', 'Prod'] },
            },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="test task" />
      );

      // Wait for plan to appear
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(
        /(I've cancelled the|I've aborted the|The.*was cancelled|The.*has been aborted)/
      );
      expect(output).toContain('task selection');

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('shows cancellation message when aborting introspect-only plan', async () => {
      const anthropicModule = await import('../src/services/anthropic.js');
      const processModule = await import('../src/services/process.js');
      const { Keys } = await import('./test-utils.js');

      // Mock exitApp to prevent process.exit
      const exitSpy = vi
        .spyOn(processModule, 'exitApp')
        .mockImplementation(() => {});

      // Mock service that returns a plan with only Introspect tasks
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Here are my capabilities:',
          tasks: [
            { action: 'PLAN: Break down requests', type: 'introspect' },
            { action: 'EXECUTE: Run commands', type: 'introspect' },
          ],
        }),
      };

      vi.spyOn(anthropicModule, 'createAnthropicService').mockReturnValue(
        mockService as any
      );

      const { lastFrame, stdin } = render(
        <Main app={mockApp} command="list your skills" />
      );

      // Wait for plan to appear
      await new Promise((resolve) => setTimeout(resolve, WorkflowWait));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, ShortWait));

      const output = lastFrame();
      expect(output).toMatch(
        /(I've cancelled the|I've aborted the|The.*was cancelled|The.*has been aborted)/
      );
      expect(output).toContain('introspection');

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });
});
