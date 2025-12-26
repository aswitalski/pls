import { beforeEach, describe, expect, it } from 'vitest';

import {
  AnthropicModel,
  ConfigError,
  configExists,
  DebugLevel,
  getAvailableConfigStructure,
  getConfigSchema,
  getConfigurationRequiredMessage,
  getConfiguredKeys,
  loadConfig,
  loadDebugSetting,
  mergeConfig,
  saveAnthropicConfig,
  saveConfig,
  saveDebugSetting,
} from '../../src/services/configuration.js';
import { createConfigStepsFromSchema } from '../../src/services/components.js';
import { MemoryFileSystem } from '../../src/services/filesystem.js';
import { StepType } from '../../src/ui/Config.js';

describe('Configuration management', () => {
  let fs: MemoryFileSystem;

  beforeEach(() => {
    fs = new MemoryFileSystem();
  });

  describe('Merging configuration', () => {
    it('creates new config when file is empty', () => {
      const result = mergeConfig('', 'anthropic', {
        key: 'sk-ant-test',
        model: 'claude-haiku-4-5-20251001',
      });

      expect(result).toContain('anthropic:');
      expect(result).toContain('  key: sk-ant-test');
      expect(result).toContain('  model: claude-haiku-4-5-20251001');
    });

    it('adds new section to existing config', () => {
      const existing = `ui:
  theme: dark
  verbose: true`;

      const result = mergeConfig(existing, 'anthropic', {
        key: 'sk-ant-test',
        model: 'claude-haiku-4-5-20251001',
      });

      expect(result).toContain('ui:');
      expect(result).toContain('  theme: dark');
      expect(result).toContain('anthropic:');
      expect(result).toContain('  key: sk-ant-test');
    });

    it('sorts sections alphabetically', () => {
      const existing = `ui:
  theme: dark`;

      const result = mergeConfig(existing, 'anthropic', {
        key: 'sk-ant-test',
      });

      const anthropicIndex = result.indexOf('anthropic:');
      const uiIndex = result.indexOf('ui:');

      expect(anthropicIndex).toBeLessThan(uiIndex);
    });

    it('updates existing section without removing other keys', () => {
      const existing = `anthropic:
  key: sk-ant-old
  custom-setting: value`;

      const result = mergeConfig(existing, 'anthropic', {
        key: 'sk-ant-new',
        model: 'claude-haiku-4-5-20251001',
      });

      expect(result).toContain('key: sk-ant-new');
      expect(result).toContain('model: claude-haiku-4-5-20251001');
      expect(result).toContain('custom-setting: value');
      expect(result).not.toContain('sk-ant-old');
    });

    it('adds empty line before new section', () => {
      const existing = `ui:
  theme: dark`;

      const result = mergeConfig(existing, 'anthropic', {
        key: 'sk-ant-test',
      });

      expect(result).toMatch(/anthropic:\n {2}key:/);
      expect(result).toMatch(/ui:\n {2}theme:/);
    });

    it('handles multiple sections with sorting', () => {
      const existing = `ui:
  theme: dark

config:
  llm: anthropic
  name: Sensei`;

      const result = mergeConfig(existing, 'anthropic', {
        key: 'sk-ant-test',
      });

      const sections = result.match(/^[a-z]+:/gm) || [];
      expect(sections).toEqual(['anthropic:', 'config:', 'ui:']);
    });

    it('updates key in existing section', () => {
      const existing = `anthropic:
  key: sk-ant-old
  model: old-model`;

      const result = mergeConfig(existing, 'anthropic', {
        model: 'new-model',
      });

      expect(result).toContain('key: sk-ant-old');
      expect(result).toContain('model: new-model');
      expect(result).not.toContain('old-model');
    });
  });

  describe('Saving configuration', () => {
    it('creates new config file when none exists', () => {
      saveConfig(
        'anthropic',
        {
          key: 'sk-ant-test',
          model: 'claude-haiku-4-5-20251001',
        },
        fs
      );

      expect(configExists(fs)).toBe(true);
      const config = loadConfig(fs);
      expect(config.anthropic.key).toBe('sk-ant-test');
    });

    it('preserves existing sections when adding new section', () => {
      saveConfig('ui', { theme: 'dark' }, fs);
      saveConfig('anthropic', { key: 'sk-ant-test' }, fs);

      const config = loadConfig(fs);
      expect(config.anthropic.key).toBe('sk-ant-test');
    });

    it('updates existing section values', () => {
      saveConfig('anthropic', { key: 'sk-ant-old' }, fs);
      saveConfig('anthropic', { key: 'sk-ant-new' }, fs);

      const config = loadConfig(fs);
      expect(config.anthropic.key).toBe('sk-ant-new');
    });
  });

  describe('Saving Anthropic configuration', () => {
    it('saves anthropic config to file', () => {
      saveAnthropicConfig(
        {
          key: 'sk-ant-test',
          model: AnthropicModel.Haiku,
        },
        fs
      );

      const config = loadConfig(fs);
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe(AnthropicModel.Haiku);
    });

    it('saves anthropic config with only required fields', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' }, fs);

      const config = loadConfig(fs);
      expect(config.anthropic.key).toBe('sk-ant-test');
    });
  });

  describe('Configuration errors', () => {
    it('creates error with message', () => {
      const error = new ConfigError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ConfigError');
    });

    it('creates error with origin', () => {
      const origin = new Error('Original error');
      const error = new ConfigError('Test error', origin);
      expect(error.message).toBe('Test error');
      expect(error.origin).toBe(origin);
    });

    it('is instance of Error', () => {
      const error = new ConfigError('Test error');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('Configuration messages', () => {
    it('returns messages ending with period', () => {
      expect(getConfigurationRequiredMessage().endsWith('.')).toBe(true);
      expect(getConfigurationRequiredMessage(true).endsWith('.')).toBe(true);
    });

    it('returns one of predefined immediate setup messages', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 50; i++) {
        messages.add(getConfigurationRequiredMessage());
      }

      expect(messages.size).toBeGreaterThan(1);
      expect(messages.size).toBeLessThanOrEqual(6);
    });

    it('returns one of predefined future setup messages', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 50; i++) {
        messages.add(getConfigurationRequiredMessage(true));
      }

      expect(messages.size).toBeGreaterThan(1);
      expect(messages.size).toBeLessThanOrEqual(6);
    });

    it('returns different messages for immediate vs future setup', () => {
      const immediateMessages = new Set<string>();
      const futureMessages = new Set<string>();

      for (let i = 0; i < 50; i++) {
        immediateMessages.add(getConfigurationRequiredMessage());
        futureMessages.add(getConfigurationRequiredMessage(true));
      }

      const intersection = new Set(
        [...immediateMessages].filter((msg) => futureMessages.has(msg))
      );

      expect(intersection.size).toBe(0);
    });
  });

  describe('Debug setting', () => {
    it('returns false when no config exists', () => {
      expect(loadDebugSetting(fs)).toBe(DebugLevel.None);
    });

    it('returns false when config exists but no debug setting', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' }, fs);
      expect(loadDebugSetting(fs)).toBe(DebugLevel.None);
    });

    it('saves debug setting to settings section', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' }, fs);
      saveDebugSetting(DebugLevel.Info, fs);

      const config = loadConfig(fs);
      expect(config.settings?.debug).toBe(DebugLevel.Info);
    });

    it('loads saved debug setting', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' }, fs);
      saveDebugSetting(DebugLevel.Info, fs);
      expect(loadDebugSetting(fs)).toBe(DebugLevel.Info);

      saveDebugSetting(DebugLevel.None, fs);
      expect(loadDebugSetting(fs)).toBe(DebugLevel.None);
    });

    it('preserves anthropic config when saving debug setting', () => {
      saveAnthropicConfig(
        {
          key: 'sk-ant-test',
          model: AnthropicModel.Sonnet,
        },
        fs
      );
      saveDebugSetting(DebugLevel.Info, fs);

      const config = loadConfig(fs);
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe(AnthropicModel.Sonnet);
      expect(config.settings?.debug).toBe(DebugLevel.Info);
    });

    it('preserves debug setting when saving anthropic config', () => {
      saveDebugSetting(DebugLevel.Info, fs);
      saveAnthropicConfig(
        {
          key: 'sk-ant-test',
          model: AnthropicModel.Haiku,
        },
        fs
      );

      const config = loadConfig(fs);
      expect(config.settings?.debug).toBe(DebugLevel.Info);
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe(AnthropicModel.Haiku);
    });

    it('updates debug setting', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' }, fs);
      saveDebugSetting(DebugLevel.Info, fs);
      expect(loadDebugSetting(fs)).toBe(DebugLevel.Info);

      saveDebugSetting(DebugLevel.None, fs);
      expect(loadDebugSetting(fs)).toBe(DebugLevel.None);

      saveDebugSetting(DebugLevel.Info, fs);
      expect(loadDebugSetting(fs)).toBe(DebugLevel.Info);
    });
  });

  describe('CONFIG tool support', () => {
    describe('Config schema', () => {
      it('returns schema with core config keys', () => {
        const schema = getConfigSchema();

        expect(schema['anthropic.key']).toBeDefined();
        expect(schema['anthropic.key'].type).toBe('regexp');
        expect(schema['anthropic.key'].required).toBe(true);

        expect(schema['anthropic.model']).toBeDefined();
        expect(schema['anthropic.model'].type).toBe('enum');

        expect(schema['settings.debug']).toBeDefined();
        expect(schema['settings.debug'].type).toBe('enum');
      });

      it('includes descriptions for all keys', () => {
        const schema = getConfigSchema();

        Object.values(schema).forEach((def) => {
          expect(def.description).toBeDefined();
          expect(typeof def.description).toBe('string');
          expect(def.description.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Config discovery', () => {
      it('returns only keys and descriptions without values', () => {
        saveAnthropicConfig(
          {
            key: 'sk-ant-test-123',
            model: AnthropicModel.Haiku,
          },
          fs
        );

        const structure = getAvailableConfigStructure(fs);

        expect(structure['anthropic.key']).toBeDefined();
        expect(structure['anthropic.key']).toBe('Anthropic API key');
        expect(structure['anthropic.key']).not.toContain('sk-ant');
      });

      it('includes discovered keys from config file', () => {
        saveConfig('custom', { mykey: 'myvalue' }, fs);

        const structure = getAvailableConfigStructure(fs);

        expect(structure['custom.mykey']).toBeDefined();
        expect(structure['custom.mykey']).toBe('Custom Mykey');
      });

      it('works when no config file exists', () => {
        const structure = getAvailableConfigStructure(fs);

        // Required keys should always be present
        expect(structure['anthropic.key']).toBeDefined();
        expect(structure['anthropic.model']).toBeDefined();

        // Optional keys should be present
        expect(structure['settings.debug']).toBe('Debug mode');
      });

      it('includes all optional keys', () => {
        // Save required config only
        saveAnthropicConfig(
          {
            key: 'sk-ant-api03-' + 'A'.repeat(95),
            model: AnthropicModel.Haiku,
          },
          fs
        );

        const structure = getAvailableConfigStructure(fs);

        // Required keys should be included
        expect(structure['anthropic.key']).toBe('Anthropic API key');
        expect(structure['anthropic.model']).toBe('Anthropic model');

        // Optional key should be in structure
        expect(structure['settings.debug']).toBe('Debug mode');
      });

      it('includes optional configured keys', () => {
        // Save required config
        saveAnthropicConfig(
          {
            key: 'sk-ant-api03-' + 'A'.repeat(95),
            model: AnthropicModel.Haiku,
          },
          fs
        );

        // Save optional debug setting
        saveDebugSetting(DebugLevel.Info, fs);

        const structure = getAvailableConfigStructure(fs);

        // Required keys should not be marked
        expect(structure['anthropic.key']).toBe('Anthropic API key');
        expect(structure['anthropic.model']).toBe('Anthropic model');

        // Optional configured key should be included
        expect(structure['settings.debug']).toBe('Debug mode');
      });
    });

    describe('Configured keys tracking', () => {
      it('returns empty array when no config file exists', () => {
        const keys = getConfiguredKeys(fs);

        expect(keys).toEqual([]);
      });

      it('returns configured keys from config file', () => {
        saveAnthropicConfig(
          {
            key: 'sk-ant-api03-' + 'A'.repeat(95),
            model: AnthropicModel.Haiku,
          },
          fs
        );

        const keys = getConfiguredKeys(fs);

        expect(keys).toContain('anthropic.key');
        expect(keys).toContain('anthropic.model');
      });

      it('returns optional configured keys', () => {
        saveAnthropicConfig(
          {
            key: 'sk-ant-api03-' + 'A'.repeat(95),
            model: AnthropicModel.Haiku,
          },
          fs
        );
        saveDebugSetting(DebugLevel.Info, fs);

        const keys = getConfiguredKeys(fs);

        expect(keys).toContain('anthropic.key');
        expect(keys).toContain('anthropic.model');
        expect(keys).toContain('settings.debug');
      });

      it('returns discovered keys from config file', () => {
        saveConfig('custom', { mykey: 'myvalue' }, fs);

        const keys = getConfiguredKeys(fs);

        expect(keys).toContain('custom.mykey');
      });

      it('handles nested config structures', () => {
        saveConfig(
          'product',
          {
            alpha: { path: '/path/to/alpha', enabled: true },
            beta: { path: '/path/to/beta', enabled: false },
          },
          fs
        );

        const keys = getConfiguredKeys(fs);

        expect(keys).toContain('product.alpha.path');
        expect(keys).toContain('product.alpha.enabled');
        expect(keys).toContain('product.beta.path');
        expect(keys).toContain('product.beta.enabled');
      });

      it('returns all keys from mixed configuration', () => {
        // Required config
        saveAnthropicConfig(
          {
            key: 'sk-ant-api03-' + 'A'.repeat(95),
            model: AnthropicModel.Haiku,
          },
          fs
        );
        // Optional config
        saveDebugSetting(DebugLevel.Info, fs);
        // Discovered config
        saveConfig('custom', { setting: 'value' }, fs);

        const keys = getConfiguredKeys(fs);

        // Required keys
        expect(keys).toContain('anthropic.key');
        expect(keys).toContain('anthropic.model');
        // Optional key
        expect(keys).toContain('settings.debug');
        // Discovered key
        expect(keys).toContain('custom.setting');
      });
    });

    describe('Config step generation', () => {
      it('creates text step for regexp type', () => {
        const steps = createConfigStepsFromSchema(['anthropic.key'], fs);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Text);
        expect(steps[0].key).toBe('key');
        expect(steps[0].description).toBe('Anthropic API key');
      });

      it('creates selection step for enum type', () => {
        const steps = createConfigStepsFromSchema(['anthropic.model'], fs);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Selection);
        expect(steps[0].key).toBe('model');
      });

      it('creates selection step for debug enum type', () => {
        const steps = createConfigStepsFromSchema(['settings.debug'], fs);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Selection);
        expect(steps[0].key).toBe('debug');
        expect(steps[0].description).toBe('Debug mode');
        // Verify it has the three debug level options
        if ('options' in steps[0]) {
          expect(steps[0].options).toHaveLength(3);
          expect(steps[0].options.map((o) => o.value)).toEqual([
            'none',
            'info',
            'verbose',
          ]);
        }
      });

      it('extracts short key from dotted path', () => {
        const steps = createConfigStepsFromSchema([
          'anthropic.key',
          'settings.debug',
        ]);

        expect(steps[0].key).toBe('key');
        expect(steps[1].key).toBe('debug');
      });

      it('uses current config value as default if valid', () => {
        saveAnthropicConfig(
          {
            key: 'sk-ant-api03-' + 'a'.repeat(95),
            model: AnthropicModel.Haiku,
          },
          fs
        );

        const steps = createConfigStepsFromSchema(
          ['anthropic.key', 'anthropic.model'],
          fs
        );

        // Check key step (text type)
        if ('value' in steps[0]) {
          expect(steps[0].value).toContain('sk-ant');
        }

        // Check model step (selection type)
        if ('defaultIndex' in steps[1] && 'options' in steps[1]) {
          expect(steps[1].defaultIndex).toBeGreaterThanOrEqual(0);
          expect(steps[1].options[steps[1].defaultIndex].value).toBe(
            AnthropicModel.Haiku
          );
        }
      });

      it('creates steps for multiple keys', () => {
        const steps = createConfigStepsFromSchema([
          'anthropic.key',
          'anthropic.model',
          'settings.debug',
        ]);

        expect(steps).toHaveLength(3);
      });

      it('creates text steps for discovered keys not in schema', () => {
        // Save some custom config that's not in the schema
        saveConfig('custom', { mykey: 'myvalue' }, fs);

        const steps = createConfigStepsFromSchema(['custom.mykey'], fs);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Text);
        expect(steps[0].key).toBe('mykey');
        expect(steps[0].path).toBe('custom.mykey');
        expect(steps[0].description).toBe('custom.mykey');
      });

      it('loads existing values for discovered config keys', () => {
        // Save config with discovered keys
        saveConfig(
          'opera',
          {
            gx: { repo: '~/Developer/gx' },
            neon: { repo: '~/Developer/neon' },
          },
          fs
        );

        const steps = createConfigStepsFromSchema(
          ['opera.gx.repo', 'opera.neon.repo'],
          fs
        );

        expect(steps).toHaveLength(2);
        expect(steps[0].type).toBe(StepType.Text);
        if (steps[0].type === StepType.Text) {
          expect(steps[0].value).toBe('~/Developer/gx');
        }
        expect(steps[0].path).toBe('opera.gx.repo');
        expect(steps[1].type).toBe(StepType.Text);
        if (steps[1].type === StepType.Text) {
          expect(steps[1].value).toBe('~/Developer/neon');
        }
        expect(steps[1].path).toBe('opera.neon.repo');
      });

      it('uses null value for discovered keys with no existing value', () => {
        const steps = createConfigStepsFromSchema(['nonexistent.key'], fs);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Text);
        if (steps[0].type === StepType.Text) {
          expect(steps[0].value).toBeNull();
        }
        expect(steps[0].path).toBe('nonexistent.key');
      });
    });
  });
});
