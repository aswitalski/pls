import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { DebugLevel } from '../../../src/configuration/types.js';

import { SettingView } from '../../../src/components/views/Setting.js';
import { ConfigStep, StepType } from '../../../src/components/views/Config.js';

describe('SettingView', () => {
  describe('Text step', () => {
    it('displays saved value when inactive', () => {
      const step: ConfigStep = {
        description: 'API Key',
        key: 'apiKey',
        type: StepType.Text,
        value: null,
        validate: () => true,
      };

      const { lastFrame } = render(
        <SettingView
          step={step}
          value="sk-test-123"
          selectedIndex={0}
          isActive={false}
        />
      );

      const output = lastFrame();
      expect(output).toContain('API Key');
      expect(output).toContain('sk-test-123');
    });
  });

  describe('Selection step', () => {
    const selectionStep: ConfigStep = {
      description: 'Choose model',
      key: 'model',
      type: StepType.Selection,
      options: [
        { label: 'Haiku', value: 'haiku' },
        { label: 'Sonnet', value: 'sonnet' },
        { label: 'Opus', value: 'opus' },
      ],
      defaultIndex: 0,
      validate: () => true,
    };

    it('shows all options when active', () => {
      const { lastFrame } = render(
        <SettingView
          step={selectionStep}
          value="haiku"
          selectedIndex={0}
          isActive={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Haiku');
      expect(output).toContain('Sonnet');
      expect(output).toContain('Opus');
    });

    it('shows only selected label when inactive', () => {
      const { lastFrame } = render(
        <SettingView
          step={selectionStep}
          value="sonnet"
          selectedIndex={1}
          isActive={false}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Sonnet');
      expect(output).not.toContain('Haiku');
      expect(output).not.toContain('Opus');
    });
  });

  describe('Debug postfix', () => {
    const createStep = (): ConfigStep => ({
      description: 'Setting',
      key: 'setting',
      path: 'app.setting',
      type: StepType.Text,
      value: null,
      validate: () => true,
    });

    it('hidden when debug is None', () => {
      const { lastFrame } = render(
        <SettingView
          step={createStep()}
          value="value"
          selectedIndex={0}
          isActive={false}
          debug={DebugLevel.None}
        />
      );

      expect(lastFrame()).not.toContain('{app.setting}');
    });

    it('shows {path} when debug is Info', () => {
      const { lastFrame } = render(
        <SettingView
          step={createStep()}
          value="value"
          selectedIndex={0}
          isActive={false}
          debug={DebugLevel.Info}
        />
      );

      expect(lastFrame()).toContain('{app.setting}');
      expect(lastFrame()).not.toContain('entry');
    });

    it('shows {path} entry when debug is Verbose', () => {
      const { lastFrame } = render(
        <SettingView
          step={createStep()}
          value="value"
          selectedIndex={0}
          isActive={false}
          debug={DebugLevel.Verbose}
        />
      );

      expect(lastFrame()).toContain('{app.setting} entry');
    });
  });
});
