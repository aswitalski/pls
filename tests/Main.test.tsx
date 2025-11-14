import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../src/types/types.js';

import { Main } from '../src/ui/Main.js';

describe('Main component queue-based architecture', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
    isDebug: false,
  };

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
        isDebug: false,
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
      const debugApp = { ...mockApp, isDebug: true };
      const normalApp = { ...mockApp, isDebug: false };

      const debugResult = <Main app={debugApp} command={null} />;
      const normalResult = <Main app={normalApp} command={null} />;

      expect(debugResult.props.app.isDebug).toBe(true);
      expect(normalResult.props.app.isDebug).toBe(false);
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have rendered the welcome screen
      const output = lastFrame();
      expect(output).toBeTruthy();

      // Should have called exitApp(0)
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Cleanup
      exitSpy.mockRestore();
    });
  });

  describe('Confirmation flow', () => {
    it('shows confirmation after plan without Define tasks', async () => {
      const componentsModule = await import('../src/services/components.js');
      const anthropicModule = await import('../src/services/anthropic.js');

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

      // Spy on createConfirmDefinition to verify it's called
      const confirmSpy = vi.spyOn(componentsModule, 'createConfirmDefinition');

      render(<Main app={mockApp} command="test task" />);

      // Wait for async processing (Command MIN_PROCESSING_TIME + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Verify createConfirmDefinition was called
      expect(confirmSpy).toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });
  });

  describe('Abort messages', () => {
    it('shows "Execution cancelled" when aborting plan confirmation', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('Execution cancelled');

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });

    it('shows "aborted by user" when aborting plan navigation', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Press Escape to abort
      stdin.write(Keys.Escape);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const output = lastFrame();
      expect(output).toContain('aborted by user');

      // Cleanup
      exitSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });
});
