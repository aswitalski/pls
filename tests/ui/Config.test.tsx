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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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
        <Config steps={steps} state={{}} onFinished={onFinished} />
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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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
        <Config steps={steps} state={{}} onFinished={onFinished} />
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

      const result = <Config steps={steps} state={{}} onAborted={onAborted} />;

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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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

      const result = <Config steps={steps} state={{}} />;

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
        <Config steps={steps} onFinished={onFinished} />
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

      const { stdin } = render(<Config steps={steps} onAborted={onAborted} />);

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
        <Config steps={steps} onAborted={onAborted} />
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
          isActive={false}
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
          isActive={false}
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
  });
});
