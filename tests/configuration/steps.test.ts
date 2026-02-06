import { describe, expect, it, vi } from 'vitest';

import {
  ConfigDefinition,
  ConfigDefinitionType,
} from '../../src/configuration/types.js';
import { createConfigStepsFromSchema } from '../../src/configuration/steps.js';
import { MemoryFileSystem } from '../../src/services/filesystem.js';
import { StepType } from '../../src/components/controllers/Config.js';

const fs = new MemoryFileSystem();

vi.mock('../../src/configuration/schema.js', () => ({
  getConfigSchema: (): Record<string, ConfigDefinition> => ({
    'app.theme': {
      type: ConfigDefinitionType.Enum,
      required: false,
      values: ['light', 'dark', 'auto'],
      description: 'App theme',
    },
    'app.mode': {
      type: ConfigDefinitionType.Enum,
      required: false,
      values: ['fast', 'balanced', 'quality'],
      default: 'balanced',
      description: 'Processing mode',
      labels: {
        fast: 'Fast',
        balanced: 'Balanced',
        quality: 'High Quality',
      },
    },
    'app.verbose': {
      type: ConfigDefinitionType.Boolean,
      required: false,
      description: 'Verbose output',
    },
  }),
}));

describe('Config step labels', () => {
  describe('enum labels', () => {
    it('uses custom labels when provided', () => {
      const steps = createConfigStepsFromSchema(['app.mode'], fs);

      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe(StepType.Selection);
      if ('options' in steps[0]) {
        expect(steps[0].options.map((o) => o.label)).toEqual([
          'Fast',
          'Balanced',
          'High Quality',
        ]);
      }
    });

    it('preserves values when custom labels are used', () => {
      const steps = createConfigStepsFromSchema(['app.mode'], fs);

      if ('options' in steps[0]) {
        expect(steps[0].options.map((o) => o.value)).toEqual([
          'fast',
          'balanced',
          'quality',
        ]);
      }
    });

    it('falls back to value as label when no labels defined', () => {
      const steps = createConfigStepsFromSchema(['app.theme'], fs);

      if ('options' in steps[0]) {
        expect(steps[0].options.map((o) => o.label)).toEqual([
          'light',
          'dark',
          'auto',
        ]);
        expect(steps[0].options.map((o) => o.value)).toEqual([
          'light',
          'dark',
          'auto',
        ]);
      }
    });
  });

  describe('boolean labels', () => {
    it('displays yes and no as labels', () => {
      const steps = createConfigStepsFromSchema(['app.verbose'], fs);

      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe(StepType.Selection);
      if ('options' in steps[0]) {
        expect(steps[0].options).toEqual([
          { label: 'yes', value: 'true' },
          { label: 'no', value: 'false' },
        ]);
      }
    });

    it('defaults to yes when no current value', () => {
      const steps = createConfigStepsFromSchema(['app.verbose'], fs);

      if ('defaultIndex' in steps[0]) {
        expect(steps[0].defaultIndex).toBe(0);
      }
    });
  });
});
