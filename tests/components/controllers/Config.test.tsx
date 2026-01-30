import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ComponentStatus, ConfigState } from '../../../src/types/components.js';
import { TaskType } from '../../../src/types/types.js';

import { AnthropicModel } from '../../../src/configuration/types.js';

import {
  Config,
  ConfigView,
  ConfigStep,
  StepType,
} from '../../../src/components/controllers/Config.js';

import {
  Keys,
  createRequestHandlers,
  createLifecycleHandlers,
  createWorkflowHandlers,
  createMockAnthropicService,
} from '../../test-utils.js';

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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
          onFinished={onFinished}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
          onFinished={onFinished}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
          onAborted={onAborted}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
          onFinished={onFinished}
          onAborted={onAborted}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
        <Config
          steps={steps}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
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
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Press Escape
      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalled();
    });

    it('abortion: does not call completeActive when onAborted is provided', () => {
      const onAborted = vi.fn();
      const lifecycleHandlers = createLifecycleHandlers({
        completeActive: vi.fn(),
      });
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
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Press Escape
      stdin.write(Keys.Escape);

      // Should call onAborted but NOT completeActive to avoid duplicate messages
      expect(onAborted).toHaveBeenCalledWith('configuration');
      expect(lifecycleHandlers.completeActive).not.toHaveBeenCalled();
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
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
        <ConfigView
          steps={steps}
          state={{
            values: {
              'opera.gx.repo': '~/Developer/gx',
              'opera.neon.repo': '~/Developer/neon',
              'opera.one.repo': '~/Developer/one',
            },
            completedStep: 3,
            selectedIndex: 0,
          }}
          status={ComponentStatus.Done}
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
        <ConfigView
          steps={steps}
          state={{
            values: {
              'section.first': 'saved1',
              'section.second': 'saved2',
            },
            completedStep: 2,
            selectedIndex: 0,
          }}
          status={ComponentStatus.Done}
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
      const stateHandlers = createRequestHandlers({
        onCompleted: vi.fn(() => callOrder.push('updateState')),
      });
      const lifecycleHandlers = createLifecycleHandlers({
        completeActive: vi.fn((..._items) => callOrder.push('completeActive')),
      });
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
          requestHandlers={stateHandlers}
          lifecycleHandlers={lifecycleHandlers}
          onFinished={onFinished}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
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
      expect(stateHandlers.onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          values: { 'settings.debug': 'true' },
          completedStep: 1,
          selectedIndex: 0,
          steps,
        })
      );
    });

    it('completion success: calls handlers.completeActive with success feedback', () => {
      const callOrder: string[] = [];
      const stateHandlers = createRequestHandlers<ConfigState>({
        onCompleted: vi.fn(() => callOrder.push('updateState')),
      });
      const lifecycleHandlers = createLifecycleHandlers({
        completeActive: vi.fn(),
      });

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
          requestHandlers={stateHandlers}
          lifecycleHandlers={lifecycleHandlers}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Complete first step
      stdin.write(Keys.Enter);

      // Abort on second step
      stdin.write(Keys.Escape);

      // Verify updateState was called at least twice:
      // 1. After completing first step
      // 2. Before aborting
      expect(stateHandlers.onCompleted).toHaveBeenCalled();

      // Check that the final updateState call saved the first value
      const updateStateMock = vi.mocked(stateHandlers.onCompleted);
      const lastCall = updateStateMock.mock.calls.at(-1)![0];
      expect(lastCall.values).toEqual(
        expect.objectContaining({ 'section.first': 'optionA' })
      );
    });

    it('abort: works without onAborted callback', () => {
      let lastFeedback: any;
      const stateHandlers = createRequestHandlers({
        onCompleted: vi.fn(),
      });
      const lifecycleHandlers = createLifecycleHandlers({
        completeActive: vi.fn((feedback) => {
          lastFeedback = feedback;
        }),
      });

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
          requestHandlers={stateHandlers}
          lifecycleHandlers={lifecycleHandlers}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Abort immediately
      stdin.write(Keys.Escape);

      // Should still complete with abort feedback
      expect(lastFeedback).toBeDefined();
      expect(lastFeedback.props.type).toBe('aborted');
      expect(lifecycleHandlers.completeActive).toHaveBeenCalled();
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
        <ConfigView
          steps={steps}
          state={{
            values: { 'settings.debug': 'false' },
            completedStep: 1,
            selectedIndex: 0,
          }}
          status={ComponentStatus.Done}
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
        <ConfigView
          steps={steps}
          state={{
            values: { 'feature.enabled': 'true' },
            completedStep: 1,
            selectedIndex: 0,
          }}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      // Should show 'yes' (the changed value), not 'no' (the default)
      expect(output).toContain('yes');
      expect(output).not.toContain('no');
    });
  });

  describe('Selection defaultIndex highlighting', () => {
    it('highlights option at defaultIndex on initial render', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Debug mode',
          key: 'debug',
          path: 'settings.debug',
          type: StepType.Selection,
          options: [
            { label: 'none', value: 'none' },
            { label: 'info', value: 'info' },
            { label: 'verbose', value: 'verbose' },
          ],
          defaultIndex: 1,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          onFinished={onFinished}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Press enter without tabbing — should submit 'info' (defaultIndex 1)
      stdin.write(Keys.Enter);

      expect(onFinished).toHaveBeenCalledWith({
        'settings.debug': 'info',
      });
    });

    it('submits correct value when defaultIndex is non-zero', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'Debug mode',
          key: 'debug',
          path: 'settings.debug',
          type: StepType.Selection,
          options: [
            { label: 'none', value: 'none' },
            { label: 'info', value: 'info' },
            { label: 'verbose', value: 'verbose' },
          ],
          defaultIndex: 2,
          validate: () => true,
        },
      ];

      const { stdin } = render(
        <Config
          steps={steps}
          onFinished={onFinished}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Press enter without tabbing — should submit 'verbose'
      stdin.write(Keys.Enter);

      expect(onFinished).toHaveBeenCalledWith({
        'settings.debug': 'verbose',
      });
    });

    it('highlights correct option for second selection step', async () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        {
          description: 'First',
          key: 'first',
          path: 'section.first',
          type: StepType.Selection,
          options: [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
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
            { label: 'Option X', value: 'x' },
            { label: 'Option Y', value: 'y' },
            { label: 'Option Z', value: 'z' },
          ],
          defaultIndex: 2,
          validate: () => true,
        },
      ];

      const { stdin, lastFrame } = render(
        <Config
          steps={steps}
          onFinished={onFinished}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Submit first step with default
      stdin.write(Keys.Enter);

      // Wait for second step to render
      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Option X');
      });

      // Submit second step with default (should be Option Z)
      stdin.write(Keys.Enter);

      await vi.waitFor(() => {
        expect(onFinished).toHaveBeenCalledWith({
          'section.first': 'a',
          'section.second': 'z',
        });
      });
    });
  });

  describe('Query-based configuration', () => {
    it('shows loading indicator while resolving query', async () => {
      // Create a service that delays resolution
      let resolvePromise: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const service = {
        processWithTool: vi.fn(() =>
          pendingPromise.then(() => ({
            message: '',
            tasks: [
              {
                action: 'API Key',
                type: TaskType.Config,
                params: { key: 'api.key' },
              },
            ],
          }))
        ),
      };

      const { lastFrame } = render(
        <Config
          query="api settings"
          service={
            service as unknown as ReturnType<typeof createMockAnthropicService>
          }
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Should show loading indicator
      expect(lastFrame()).toContain('Resolving configuration...');

      // Cleanup
      resolvePromise!();
    });

    it('calls CONFIGURE tool with query when no steps provided', async () => {
      const processWithToolSpy = vi.fn().mockResolvedValue({
        message: '',
        tasks: [
          {
            action: 'Enter your API key',
            type: TaskType.Config,
            params: { key: 'api.key' },
          },
        ],
      });

      const service = {
        processWithTool: processWithToolSpy,
      } as unknown as ReturnType<typeof createMockAnthropicService>;

      render(
        <Config
          query="api settings"
          service={service}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Wait for async resolution
      await vi.waitFor(() => {
        expect(processWithToolSpy).toHaveBeenCalledWith(
          'api settings',
          'configure'
        );
      });
    });

    it('resolves query to config steps via CONFIGURE tool', async () => {
      const service = createMockAnthropicService({
        tasks: [
          {
            action: 'Enter your API key',
            type: TaskType.Config,
            params: { key: 'api.key' },
          },
          {
            action: 'Choose model',
            type: TaskType.Config,
            params: { key: 'api.model' },
          },
        ],
      });

      const { lastFrame } = render(
        <Config
          query="api settings"
          service={service}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Wait for resolution and step rendering
      await vi.waitFor(() => {
        const output = lastFrame();
        expect(output).toContain('Enter your API key');
      });
    });

    it('handles error when no config tasks match query', async () => {
      const lifecycleHandlers = createLifecycleHandlers({
        completeActive: vi.fn(),
      });

      const service = createMockAnthropicService({
        tasks: [], // No config tasks returned
      });

      render(
        <Config
          query="unknown setting"
          service={service}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={lifecycleHandlers}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Wait for error handling
      await vi.waitFor(() => {
        expect(lifecycleHandlers.completeActive).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({
              message: 'No configuration settings matched your query.',
            }),
          })
        );
      });
    });

    it('includes resolved steps in state on abort', async () => {
      // Test that steps are preserved in state even when aborting
      // This verifies the bug fix where query-resolved steps weren't saved
      const stateHandlers = createRequestHandlers<ConfigState>({
        onCompleted: vi.fn(),
      });
      const onAborted = vi.fn();

      const service = createMockAnthropicService({
        tasks: [
          {
            action: 'Enable feature',
            type: TaskType.Config,
            params: { key: 'feature.enabled' },
          },
        ],
      });

      const { stdin, lastFrame } = render(
        <Config
          query="feature settings"
          service={service}
          requestHandlers={stateHandlers}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      // Wait for resolution
      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Enable feature');
      });

      // Abort the config (Escape key)
      stdin.write(Keys.Escape);

      // Verify steps are included in state on abort
      await vi.waitFor(() => {
        expect(stateHandlers.onCompleted).toHaveBeenCalledWith(
          expect.objectContaining({
            steps: expect.arrayContaining([
              expect.objectContaining({
                key: 'enabled',
              }),
            ]),
          })
        );
      });
    });

    it('skips query resolution when steps are provided', () => {
      const processWithToolSpy = vi.fn();
      const service = {
        processWithTool: processWithToolSpy,
      } as unknown as ReturnType<typeof createMockAnthropicService>;

      const steps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'apiKey',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
      ];

      render(
        <Config
          steps={steps}
          query="should be ignored"
          service={service}
          requestHandlers={createRequestHandlers<ConfigState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          status={ComponentStatus.Active}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Should not call service when steps are provided
      expect(processWithToolSpy).not.toHaveBeenCalled();
    });
  });

  describe('Timeline rendering with state steps', () => {
    it('displays config entries from state.steps in timeline', () => {
      // This tests the bug fix where query-resolved configs weren't showing
      // in the timeline because ViewComponent only read props.steps

      const resolvedSteps: ConfigStep[] = [
        {
          description: 'API Key',
          key: 'api.key',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
        {
          description: 'Model Selection',
          key: 'api.model',
          type: StepType.Text,
          value: 'haiku',
          validate: () => true,
        },
      ];

      const { lastFrame } = render(
        <ConfigView
          steps={resolvedSteps}
          state={{
            values: {
              'api.key': 'sk-test-key-123',
              'api.model': 'sonnet',
            },
            completedStep: 2,
            selectedIndex: 0,
            steps: resolvedSteps,
          }}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      // Should display both configured values
      expect(output).toContain('API Key');
      expect(output).toContain('sk-test-key-123');
      expect(output).toContain('Model Selection');
      expect(output).toContain('sonnet');
    });

    it('shows all completed steps when config is done', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Username',
          key: 'user.name',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
        {
          description: 'Email',
          key: 'user.email',
          type: StepType.Text,
          value: null,
          validate: () => true,
        },
        {
          description: 'Notifications',
          key: 'user.notifications',
          type: StepType.Selection,
          options: [
            { label: 'enabled', value: 'true' },
            { label: 'disabled', value: 'false' },
          ],
          defaultIndex: 0,
          validate: () => true,
        },
      ];

      const { lastFrame } = render(
        <ConfigView
          steps={steps}
          state={{
            values: {
              'user.name': 'testuser',
              'user.email': 'test@example.com',
              'user.notifications': 'true',
            },
            completedStep: 3,
            selectedIndex: 0,
            steps,
          }}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      // All three completed entries should be visible
      expect(output).toContain('Username');
      expect(output).toContain('testuser');
      expect(output).toContain('Email');
      expect(output).toContain('test@example.com');
      expect(output).toContain('Notifications');
      expect(output).toContain('enabled');
    });
  });
});
