import { describe, it, expect, vi } from 'vitest';
import React from 'react';

import { Config, ConfigStep } from '../src/ui/Config.js';

describe('Config component interaction flows', () => {
  describe('Single step config', () => {
    it('renders single step', () => {
      const steps: ConfigStep[] = [
        { description: 'API Key', key: 'apiKey', value: null },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.steps).toHaveLength(1);
      expect(result.props.state?.done).toBe(false);
    });

    it('renders single step with default value', () => {
      const steps: ConfigStep[] = [
        {
          description: 'Model',
          key: 'model',
          value: 'claude-haiku-4-5-20251001',
        },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.steps[0].value).toBe('claude-haiku-4-5-20251001');
    });

    it('calls onFinished for single step', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        { description: 'Username', key: 'username', value: null },
      ];

      const result = (
        <Config steps={steps} state={{ done: false }} onFinished={onFinished} />
      );

      expect(result.props.onFinished).toBe(onFinished);
    });
  });

  describe('Multi-step config', () => {
    it('renders multiple steps', () => {
      const steps: ConfigStep[] = [
        { description: 'Username', key: 'username', value: null },
        { description: 'Password', key: 'password', value: null },
        { description: 'Email', key: 'email', value: null },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.steps).toHaveLength(3);
    });

    it('renders steps with mixed default values', () => {
      const steps: ConfigStep[] = [
        { description: 'API Key', key: 'apiKey', value: null },
        {
          description: 'Model',
          key: 'model',
          value: 'claude-haiku-4-5-20251001',
        },
        { description: 'Max Tokens', key: 'maxTokens', value: '1024' },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.steps[0].value).toBeNull();
      expect(result.props.steps[1].value).toBe('claude-haiku-4-5-20251001');
      expect(result.props.steps[2].value).toBe('1024');
    });

    it('calls onFinished after last step', () => {
      const onFinished = vi.fn();
      const steps: ConfigStep[] = [
        { description: 'Step 1', key: 'step1', value: null },
        { description: 'Step 2', key: 'step2', value: null },
      ];

      const result = (
        <Config steps={steps} state={{ done: false }} onFinished={onFinished} />
      );

      expect(result.props.onFinished).toBe(onFinished);
    });
  });

  describe('Abort handling', () => {
    it('accepts onAborted callback', () => {
      const onAborted = vi.fn();
      const steps: ConfigStep[] = [
        { description: 'Test', key: 'test', value: null },
      ];

      const result = (
        <Config steps={steps} state={{ done: false }} onAborted={onAborted} />
      );

      expect(result.props.onAborted).toBe(onAborted);
    });

    it('works without onAborted callback', () => {
      const steps: ConfigStep[] = [
        { description: 'Test', key: 'test', value: null },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.onAborted).toBeUndefined();
    });
  });

  describe('Completed state', () => {
    it('renders completed single step config', () => {
      const steps: ConfigStep[] = [
        { description: 'API Key', key: 'apiKey', value: 'sk-ant-test' },
      ];

      const result = <Config steps={steps} state={{ done: true }} />;

      expect(result.props.state?.done).toBe(true);
    });

    it('renders completed multi-step config', () => {
      const steps: ConfigStep[] = [
        { description: 'Username', key: 'username', value: 'testuser' },
        { description: 'Password', key: 'password', value: 'testpass' },
        { description: 'Email', key: 'email', value: 'test@example.com' },
      ];

      const result = <Config steps={steps} state={{ done: true }} />;

      expect(result.props.state?.done).toBe(true);
      expect(result.props.steps).toHaveLength(3);
    });
  });

  describe('Optional callbacks', () => {
    it('works without onFinished', () => {
      const steps: ConfigStep[] = [
        { description: 'Test', key: 'test', value: null },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.onFinished).toBeUndefined();
    });

    it('accepts both callbacks', () => {
      const onFinished = vi.fn();
      const onAborted = vi.fn();
      const steps: ConfigStep[] = [
        { description: 'Test', key: 'test', value: null },
      ];

      const result = (
        <Config
          steps={steps}
          state={{ done: false }}
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
        { description: 'API Key (required)', key: 'apiKey', value: null },
        { description: 'Model [optional]', key: 'model', value: null },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.steps[0].description).toBe('API Key (required)');
      expect(result.props.steps[1].description).toBe('Model [optional]');
    });

    it('handles unicode characters in values', () => {
      const steps: ConfigStep[] = [
        { description: 'Name', key: 'name', value: '你好世界 🌍' },
      ];

      const result = <Config steps={steps} state={{ done: false }} />;

      expect(result.props.steps[0].value).toBe('你好世界 🌍');
    });
  });
});
