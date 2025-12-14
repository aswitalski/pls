import { ComponentStatus } from '../../src/types/components.js';
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { AnthropicModel } from '../../src/services/configuration.js';

import { Config, ConfigStep, StepType } from '../../src/ui/Config.js';
import { Keys } from '../test-utils.js';

describe('Config component interaction flows', () => {
  const mockValidate = () => true;

  describe('Single step config', () => {
    it('renders single step', () => {
      const steps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'apiKey',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps).toHaveLength(1);
    });

    it('renders single step with default value', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          type: StepType.Text,
          value: AnthropicModel.Haiku,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps[0].value).toBe(AnthropicModel.Haiku);
    });

    it('calls onFinished for single step', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Username',
          key: 'username',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config
          steps={steps}
          state={{}}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      expect(result.props.onFinished).toBe(onFinished);
    });
  });

  describe('Multi-step config', () => {
    it('renders multiple steps', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Username',
          key: 'username',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'Password',
          key: 'password',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'Email',
          key: 'email',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps).toHaveLength(3);
    });

    it('renders steps with mixed default values', () => {
      const steps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'apiKey',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'Model',
          key: 'model',
          type: StepType.Text,
          value: 'claude-haiku-4-5-20251001',
          validate: mockValidate,
        },
        {
          description: 'Max Tokens',
          key: 'maxTokens',
          type: StepType.Text,
          value: '1024',
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps[0].value).toBeNull();
      expect(result.props.steps[1].value).toBe('claude-haiku-4-5-20251001');
      expect(result.props.steps[2].value).toBe('1024');
    });

    it('calls onFinished after last step', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Step 1',
          key: 'step1',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'Step 2',
          key: 'step2',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config
          steps={steps}
          state={{}}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      expect(result.props.onFinished).toBe(onFinished);
    });
  });

  describe('Abort handling', () => {
    it('accepts onAborted callback', () => {
      const onAborted = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Test',
          key: 'test',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config
          steps={steps}
          state={{}}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      expect(result.props.onAborted).toBe(onAborted);
    });

    it('works without onAborted callback', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Test',
          key: 'test',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.onAborted).toBeUndefined();
    });
  });

  describe('Completed state', () => {
    it('renders completed single step config', () => {
      const steps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'apiKey',
          type: StepType.Text,
          value: 'sk-ant-test',
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps[0].value).toBe('sk-ant-test');
    });

    it('renders completed multi-step config', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Username',
          key: 'username',
          type: StepType.Text,
          value: 'testuser',
          validate: mockValidate,
        },
        {
          description: 'Password',
          key: 'password',
          type: StepType.Text,
          value: 'testpass',
          validate: mockValidate,
        },
        {
          description: 'Email',
          key: 'email',
          type: StepType.Text,
          value: 'test@example.com',
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps).toHaveLength(3);
      expect(result.props.steps[0].value).toBe('testuser');
      expect(result.props.steps[1].value).toBe('testpass');
      expect(result.props.steps[2].value).toBe('test@example.com');
    });
  });

  describe('Optional callbacks', () => {
    it('works without onFinished', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Test',
          key: 'test',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.onFinished).toBeUndefined();
    });

    it('accepts both callbacks', () => {
      const onFinished = vi.fn();
      const onAborted = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Test',
          key: 'test',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config
          steps={steps}
          state={{}}
          onFinished={onFinished}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      expect(result.props.onFinished).toBe(onFinished);
      expect(result.props.onAborted).toBe(onAborted);
    });
  });

  describe('Edge cases', () => {
    it('handles steps with special characters in descriptions', () => {
      const steps: ConfigStep[] = [
        {
          description: 'API Key (required)',
          key: 'apiKey',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'Model [optional]',
          key: 'model',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps[0].description).toBe('API Key (required)');
      expect(result.props.steps[1].description).toBe('Model [optional]');
    });

    it('handles unicode characters in values', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Name',
          key: 'name',
          type: StepType.Text,
          value: '你好世界 🌍',
          validate: mockValidate,
        },
      ];

      const result = (
        <Config steps={steps} state={{}} status={ComponentStatus.Active} />
      );

      expect(result.props.steps[0].value).toBe('你好世界 🌍');
    });
  });

  describe('Completion and abortion behavior', () => {
    it('completion: calls onFinished with default selection value', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          type: StepType.Selection,
          options: [
            { label: 'Haiku 4.5', value: AnthropicModel.Haiku },
            { label: 'Sonnet 4.5', value: AnthropicModel.Sonnet },
            { label: 'Opus 4.1', value: AnthropicModel.Opus },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      // Press enter to accept default (Haiku)
      stdin.write(Keys.Enter);

      expect(onFinished).toHaveBeenCalledWith({
        model: AnthropicModel.Haiku,
      });
    });

    it('abortion: calls onAborted when escape is pressed', () => {
      const onAborted = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'apiKey',
          type: StepType.Text,
          value: null,
          validate: (val) => val.length > 0,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      // Press Escape
      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalled();
    });

    it('abortion: preserves selected value from selection step', () => {
      const onAborted = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          type: StepType.Selection,
          options: [
            { label: 'Haiku 4.5', value: AnthropicModel.Haiku },
            { label: 'Sonnet 4.5', value: AnthropicModel.Sonnet },
            { label: 'Opus 4.1', value: AnthropicModel.Opus },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin, lastFrame } = render(
        <Config
          steps={steps}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      // Press Escape immediately (preserves default)
      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalled();

      // Check that Haiku (default) is visible in the UI
      const output = lastFrame();
      expect(output).toContain('Haiku 4.5');
    });
  });

  describe('State persistence', () => {
    it('displays all values including last one when not active', () => {
      const steps: ConfigStep[] = [
        {
          description: 'opera.gx.repo',
          key: 'repo',
          path: 'opera.gx.repo',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'opera.neon.repo',
          key: 'repo',
          path: 'opera.neon.repo',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
        {
          description: 'opera.one.repo',
          key: 'repo',
          path: 'opera.one.repo',
          type: StepType.Text,
          value: null,
          validate: mockValidate,
        },
      ];

      const { lastFrame } = render(
        <Config
          steps={steps}
          status={ComponentStatus.Done}
          state={{
            values: {
              'opera.gx.repo': '~/Developer/gx',
              'opera.neon.repo': '~/Developer/neon',
              'opera.one.repo': '~/Developer/one',
            },
            completedStep: 3,
          }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('~/Developer/gx');
      expect(output).toContain('~/Developer/neon');
      expect(output).toContain('~/Developer/one');
    });

    it('uses state values when not active instead of local values', () => {
      const steps: ConfigStep[] = [
        {
          description: 'First',
          key: 'first',
          path: 'section.first',
          type: StepType.Text,
          value: 'default1',
          validate: mockValidate,
        },
        {
          description: 'Second',
          key: 'second',
          path: 'section.second',
          type: StepType.Text,
          value: 'default2',
          validate: mockValidate,
        },
      ];

      // State values should override defaults when not active
      const { lastFrame } = render(
        <Config
          steps={steps}
          status={ComponentStatus.Done}
          state={{
            values: {
              'section.first': 'saved1',
              'section.second': 'saved2',
            },
            completedStep: 2,
          }}
        />
      );

      const output = lastFrame();
      expect(output).toContain('saved1');
      expect(output).toContain('saved2');
      expect(output).not.toContain('default1');
      expect(output).not.toContain('default2');
    });

    it('calls updateState BEFORE onFinished to preserve state', () => {
      const callOrder: string[] = [];
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(() => callOrder.push('updateState')),
        completeActive: vi.fn(() => callOrder.push('completeActive')),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };
      const onFinished = vi.fn(() => callOrder.push('onFinished'));

      const steps: ConfigStep[] = [
        {
          description: 'Debug mode',
          key: 'debug',
          path: 'settings.debug',
          type: StepType.Selection,
          options: [
            { label: 'yes', value: 'true' },
            { label: 'no', value: 'false' },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      // Press Enter to submit default value
      stdin.write(Keys.Enter);

      // Verify updateState was called BEFORE onFinished, then completeActive
      expect(callOrder).toEqual([
        'updateState',
        'onFinished',
        'completeActive',
      ]);
      expect(mockHandlers.updateState).toHaveBeenCalledWith({
        values: { 'settings.debug': 'true' },
        completedStep: 1,
      });
    });

    it('completion success: calls handlers.completeActive with success feedback', () => {
      const callOrder: string[] = [];
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(() => callOrder.push('updateState')),
        completeActive: vi.fn((feedback) => {
          callOrder.push('completeActive');
          // Store the feedback for verification
          (mockHandlers as any).lastFeedback = feedback;
        }),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };
      const onFinished = vi.fn(() => callOrder.push('onFinished'));

      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          path: 'anthropic.model',
          type: StepType.Selection,
          options: [
            { label: 'Haiku 4.5', value: AnthropicModel.Haiku },
            { label: 'Sonnet 4.5', value: AnthropicModel.Sonnet },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      // Press Enter to submit default value
      stdin.write(Keys.Enter);

      // Verify flow: updateState → onFinished → completeActive
      expect(callOrder).toEqual([
        'updateState',
        'onFinished',
        'completeActive',
      ]);

      // Verify completeActive was called with success feedback
      const feedback = (mockHandlers as any).lastFeedback;
      expect(feedback).toBeDefined();
      expect(feedback.name).toBe('feedback');
      expect(feedback.props.type).toBe('succeeded');
      expect(feedback.props.message).toContain('saved successfully');
    });

    it('completion error: calls handlers.completeActive with error feedback when onFinished throws', () => {
      const callOrder: string[] = [];
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(() => callOrder.push('updateState')),
        completeActive: vi.fn((feedback) => {
          callOrder.push('completeActive');
          (mockHandlers as any).lastFeedback = feedback;
        }),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };
      const onFinished = vi.fn(() => {
        callOrder.push('onFinished');
        throw new Error('Failed to save configuration');
      });

      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          path: 'anthropic.model',
          type: StepType.Selection,
          options: [
            { label: 'Haiku 4.5', value: AnthropicModel.Haiku },
            { label: 'Sonnet 4.5', value: AnthropicModel.Sonnet },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      // Press Enter to submit default value
      stdin.write(Keys.Enter);

      // Verify flow: updateState → onFinished → completeActive (even though error)
      expect(callOrder).toEqual([
        'updateState',
        'onFinished',
        'completeActive',
      ]);

      // Verify completeActive was called with error feedback
      const feedback = (mockHandlers as any).lastFeedback;
      expect(feedback).toBeDefined();
      expect(feedback.name).toBe('feedback');
      expect(feedback.props.type).toBe('failed');
      expect(feedback.props.message).toBe('Failed to save configuration');
    });

    it('completion error: handles non-Error exceptions from onFinished', () => {
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(),
        completeActive: vi.fn((feedback) => {
          (mockHandlers as any).lastFeedback = feedback;
        }),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };
      const onFinished = vi.fn(() => {
        throw 'String error'; // Non-Error exception
      });

      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          type: StepType.Selection,
          options: [
            { label: 'Haiku 4.5', value: AnthropicModel.Haiku },
            { label: 'Sonnet 4.5', value: AnthropicModel.Sonnet },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          onFinished={onFinished}
          status={ComponentStatus.Active}
        />
      );

      stdin.write(Keys.Enter);

      // Should use fallback error message
      const feedback = (mockHandlers as any).lastFeedback;
      expect(feedback).toBeDefined();
      expect(feedback.props.type).toBe('failed');
      expect(feedback.props.message).toBe('Configuration failed');
    });

    it('abort: calls onAborted, updateState, and handlers.completeActive with abort feedback', () => {
      const callOrder: string[] = [];
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(() => callOrder.push('updateState')),
        completeActive: vi.fn((feedback) => {
          callOrder.push('completeActive');
          (mockHandlers as any).lastFeedback = feedback;
        }),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };
      const onAborted = vi.fn(() => callOrder.push('onAborted'));

      const steps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'apiKey',
          path: 'anthropic.key',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
        {
          description: 'Model',
          key: 'model',
          path: 'anthropic.model',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      // Enter first value
      stdin.write('sk-ant-test-key');
      stdin.write(Keys.Enter);

      // Abort on second step
      stdin.write(Keys.Escape);

      // Verify abort flow: updateState → onAborted → completeActive
      expect(callOrder).toContain('updateState');
      expect(callOrder).toContain('onAborted');
      expect(callOrder).toContain('completeActive');

      // Verify onAborted was called with correct operation name
      expect(onAborted).toHaveBeenCalledWith('configuration');

      // Verify completeActive was called with abort feedback
      const feedback = (mockHandlers as any).lastFeedback;
      expect(feedback).toBeDefined();
      expect(feedback.name).toBe('feedback');
      expect(feedback.props.type).toBe('aborted');
      expect(feedback.props.message).toContain('cancelled');
    });

    it('abort: saves partial state before aborting', () => {
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(),
        completeActive: vi.fn(),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };

      const steps: ConfigStep[] = [
        {
          description: 'First',
          key: 'first',
          path: 'section.first',
          type: StepType.Selection,
          options: [
            { label: 'Option A', value: 'optionA' },
            { label: 'Option B', value: 'optionB' },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
        {
          description: 'Second',
          key: 'second',
          path: 'section.second',
          type: StepType.Selection,
          options: [
            { label: 'Option C', value: 'optionC' },
            { label: 'Option D', value: 'optionD' },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          status={ComponentStatus.Active}
        />
      );

      // Complete first step
      stdin.write(Keys.Enter);

      // Abort on second step
      stdin.write(Keys.Escape);

      // Verify updateState was called at least twice:
      // 1. After completing first step
      // 2. Before aborting
      expect(mockHandlers.updateState).toHaveBeenCalled();

      // Check that the final updateState call saved the first value
      const lastCall =
        mockHandlers.updateState.mock.calls[
          mockHandlers.updateState.mock.calls.length - 1
        ][0];
      expect(lastCall.values).toEqual(
        expect.objectContaining({ 'section.first': 'optionA' })
      );
    });

    it('abort: works without onAborted callback', () => {
      const mockHandlers = {
        addToQueue: vi.fn(),
        updateState: vi.fn(),
        completeActive: vi.fn((feedback) => {
          (mockHandlers as any).lastFeedback = feedback;
        }),
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
      };

      const steps: ConfigStep[] = [
        {
          description: 'Test',
          key: 'test',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          handlers={mockHandlers}
          status={ComponentStatus.Active}
        />
      );

      // Abort immediately
      stdin.write(Keys.Escape);

      // Should still complete with abort feedback
      const feedback = (mockHandlers as any).lastFeedback;
      expect(feedback).toBeDefined();
      expect(feedback.props.type).toBe('aborted');
      expect(mockHandlers.completeActive).toHaveBeenCalled();
    });

    it('preserves selection state when rendered in timeline', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Debug mode',
          key: 'debug',
          path: 'settings.debug',
          type: StepType.Selection,
          options: [
            { label: 'yes', value: 'true' },
            { label: 'no', value: 'false' },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      // Render as inactive (in timeline) with saved state
      const { lastFrame } = render(
        <Config
          steps={steps}
          status={ComponentStatus.Done}
          state={{
            values: { 'settings.debug': 'false' },
            completedStep: 1,
          }}
        />
      );

      const output = lastFrame();
      // Should show 'no' (the saved value), not 'yes' (the default)
      expect(output).toContain('no');
      expect(output).not.toContain('yes');
    });

    it('displays changed boolean selection in timeline', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Enable feature',
          key: 'enabled',
          path: 'feature.enabled',
          type: StepType.Selection,
          options: [
            { label: 'yes', value: 'true' },
            { label: 'no', value: 'false' },
          ],
          defaultIndex: 1, // Default is 'no' (false)
          validate: () => true,
        },
      ];

      // User changed from default 'no' to 'yes'
      const { lastFrame } = render(
        <Config
          steps={steps}
          status={ComponentStatus.Done}
          state={{
            values: { 'feature.enabled': 'true' },
            completedStep: 1,
          }}
        />
      );

      const output = lastFrame();
      // Should show 'yes' (the changed value), not 'no' (the default)
      expect(output).toContain('yes');
      expect(output).not.toContain('no');
    });
  });
});
