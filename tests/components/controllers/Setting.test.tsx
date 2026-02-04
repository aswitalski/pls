import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../../src/configuration/types.js';

import { Setting } from '../../../src/components/controllers/Setting.js';
import {
  ConfigOption,
  ConfigStep,
  StepType,
} from '../../../src/components/views/Config.js';

import { Keys } from '../../test-utils.js';

function createSelectionStep(options: ConfigOption[]): ConfigStep {
  return {
    description: 'Selection',
    key: 'selection',
    type: StepType.Selection,
    options,
    defaultIndex: 0,
    validate: () => true,
  };
}

function renderActiveSetting(step: ConfigStep, initialValue: string) {
  const onSubmit = vi.fn();
  const { stdin } = render(
    <Setting
      step={step}
      initialValue={initialValue}
      isActive={true}
      debug={DebugLevel.None}
      onSubmit={onSubmit}
    />
  );
  return { stdin, onSubmit };
}

const tick = () => new Promise((r) => setTimeout(r, 50));

describe('Setting controller', () => {
  describe('Text input', () => {
    it('falls back to step default when input is empty', async () => {
      const onSubmit = vi.fn();
      const step: ConfigStep = {
        description: 'Model',
        key: 'model',
        type: StepType.Text,
        value: 'default-model',
        validate: () => true,
      };

      const { stdin } = render(
        <Setting
          step={step}
          initialValue=""
          isActive={true}
          debug={DebugLevel.None}
          onSubmit={onSubmit}
        />
      );

      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('default-model');
    });

    it('blocks submission when validation fails with no fallback', async () => {
      const onSubmit = vi.fn();
      const step: ConfigStep = {
        description: 'Required',
        key: 'required',
        type: StepType.Text,
        value: null,
        validate: (val) => val.length > 0,
      };

      const { stdin } = render(
        <Setting
          step={step}
          initialValue=""
          isActive={true}
          debug={DebugLevel.None}
          onSubmit={onSubmit}
        />
      );

      stdin.write(Keys.Enter);

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Selection', () => {
    const threeOptions: ConfigOption[] = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ];

    const twoOptions: ConfigOption[] = [
      { label: 'First', value: 'first' },
      { label: 'Last', value: 'last' },
    ];

    it('restores selection index from initial value', async () => {
      const step = createSelectionStep(threeOptions);
      const { stdin, onSubmit } = renderActiveSetting(step, 'b');

      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('b');
    });

    it('ignores input when inactive', async () => {
      const onSubmit = vi.fn();
      const step = createSelectionStep(twoOptions);

      const { stdin } = render(
        <Setting
          step={step}
          initialValue="first"
          isActive={false}
          debug={DebugLevel.None}
          onSubmit={onSubmit}
        />
      );

      stdin.write(Keys.Tab);
      stdin.write(Keys.Enter);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('navigates forward with Tab key', async () => {
      const step = createSelectionStep(threeOptions);
      const { stdin, onSubmit } = renderActiveSetting(step, 'a');

      stdin.write(Keys.Tab);
      await tick();
      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('b');
    });

    it('navigates forward with Right Arrow key', async () => {
      const step = createSelectionStep(twoOptions);
      const { stdin, onSubmit } = renderActiveSetting(step, 'first');

      stdin.write(Keys.ArrowRight);
      await tick();
      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('last');
    });

    it('navigates backward with Left Arrow key', async () => {
      const step = createSelectionStep(threeOptions);
      const { stdin, onSubmit } = renderActiveSetting(step, 'b');

      stdin.write(Keys.ArrowLeft);
      await tick();
      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('a');
    });

    it('wraps from last to first option', async () => {
      const step = createSelectionStep(twoOptions);
      const { stdin, onSubmit } = renderActiveSetting(step, 'last');

      stdin.write(Keys.Tab);
      await tick();
      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('first');
    });

    it('wraps from first to last option', async () => {
      const step = createSelectionStep(twoOptions);
      const { stdin, onSubmit } = renderActiveSetting(step, 'first');

      stdin.write(Keys.ArrowLeft);
      await tick();
      stdin.write(Keys.Enter);

      expect(onSubmit).toHaveBeenCalledWith('last');
    });
  });
});
