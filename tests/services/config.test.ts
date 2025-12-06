import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AnthropicModel,
  ConfigError,
  configExists,
  getAvailableConfigStructure,
  getConfigPath,
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
import { StepType } from '../../src/ui/Config.js';

import { safeRemoveDirectory } from '../test-utils.js';

describe('Configuration management', () => {
  let originalHome: string | undefined;
  let tempHome: string;

  beforeEach(() => {
    originalHome = process.env.HOME;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    tempHome = join(tmpdir(), `pls-config-test-${Date.now()}`);
    mkdirSync(tempHome, { recursive: true });
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    safeRemoveDirectory(tempHome);
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
      saveConfig('anthropic', {
        key: 'sk-ant-test',
        model: 'claude-haiku-4-5-20251001',
      });

      expect(configExists()).toBe(true);
      const config = loadConfig();
      expect(config.anthropic.key).toBe('sk-ant-test');
    });

    it('preserves existing sections when adding new section', () => {
      saveConfig('ui', { theme: 'dark' });
      saveConfig('anthropic', { key: 'sk-ant-test' });

      const config = loadConfig();
      expect(config.anthropic.key).toBe('sk-ant-test');
    });

    it('updates existing section values', () => {
      saveConfig('anthropic', { key: 'sk-ant-old' });
      saveConfig('anthropic', { key: 'sk-ant-new' });

      const config = loadConfig();
      expect(config.anthropic.key).toBe('sk-ant-new');
    });
  });

  describe('Saving Anthropic configuration', () => {
    it('saves anthropic config to file', () => {
      saveAnthropicConfig({
        key: 'sk-ant-test',
        model: AnthropicModel.Haiku,
      });

      const config = loadConfig();
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe(AnthropicModel.Haiku);
    });

    it('saves anthropic config with only required fields', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' });

      const config = loadConfig();
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
      expect(loadDebugSetting()).toBe(false);
    });

    it('returns false when config exists but no debug setting', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' });
      expect(loadDebugSetting()).toBe(false);
    });

    it('saves debug setting to settings section', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' });
      saveDebugSetting(true);

      const config = loadConfig();
      expect(config.settings?.debug).toBe(true);
    });

    it('loads saved debug setting', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' });
      saveDebugSetting(true);
      expect(loadDebugSetting()).toBe(true);

      saveDebugSetting(false);
      expect(loadDebugSetting()).toBe(false);
    });

    it('preserves anthropic config when saving debug setting', () => {
      saveAnthropicConfig({
        key: 'sk-ant-test',
        model: AnthropicModel.Sonnet,
      });
      saveDebugSetting(true);

      const config = loadConfig();
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe(AnthropicModel.Sonnet);
      expect(config.settings?.debug).toBe(true);
    });

    it('preserves debug setting when saving anthropic config', () => {
      saveDebugSetting(true);
      saveAnthropicConfig({
        key: 'sk-ant-test',
        model: AnthropicModel.Haiku,
      });

      const config = loadConfig();
      expect(config.settings?.debug).toBe(true);
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe(AnthropicModel.Haiku);
    });

    it('updates debug setting', () => {
      saveAnthropicConfig({ key: 'sk-ant-test' });
      saveDebugSetting(true);
      expect(loadDebugSetting()).toBe(true);

      saveDebugSetting(false);
      expect(loadDebugSetting()).toBe(false);

      saveDebugSetting(true);
      expect(loadDebugSetting()).toBe(true);
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
        expect(schema['settings.debug'].type).toBe('boolean');
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
        saveAnthropicConfig({
          key: 'sk-ant-test-123',
          model: AnthropicModel.Haiku,
        });

        const structure = getAvailableConfigStructure();

        expect(structure['anthropic.key']).toBeDefined();
        expect(structure['anthropic.key']).toBe('Anthropic API key');
        expect(structure['anthropic.key']).not.toContain('sk-ant');
      });

      it('includes discovered keys from config file', () => {
        saveConfig('custom', { mykey: 'myvalue' });

        const structure = getAvailableConfigStructure();

        expect(structure['custom.mykey']).toBeDefined();
        expect(structure['custom.mykey']).toContain('discovered');
      });

      it('works when no config file exists', () => {
        const structure = getAvailableConfigStructure();

        // Required keys should always be present
        expect(structure['anthropic.key']).toBeDefined();
        expect(structure['anthropic.model']).toBeDefined();

        // Optional keys should be present and marked
        expect(structure['settings.debug']).toBe('Debug mode (optional)');
      });

      it('includes all optional keys marked as (optional)', () => {
        // Save required config only
        saveAnthropicConfig({
          key: 'sk-ant-api03-' + 'A'.repeat(95),
          model: AnthropicModel.Haiku,
        });

        const structure = getAvailableConfigStructure();

        // Required keys should be included
        expect(structure['anthropic.key']).toBe('Anthropic API key');
        expect(structure['anthropic.model']).toBe('Anthropic model');

        // Optional key should be in structure marked as optional
        expect(structure['settings.debug']).toBe('Debug mode (optional)');
      });

      it('includes optional configured keys marked with (optional)', () => {
        // Save required config
        saveAnthropicConfig({
          key: 'sk-ant-api03-' + 'A'.repeat(95),
          model: AnthropicModel.Haiku,
        });

        // Save optional debug setting
        saveDebugSetting(true);

        const structure = getAvailableConfigStructure();

        // Required keys should not be marked
        expect(structure['anthropic.key']).toBe('Anthropic API key');
        expect(structure['anthropic.model']).toBe('Anthropic model');

        // Optional configured key should be included and marked
        expect(structure['settings.debug']).toBe('Debug mode (optional)');
      });
    });

    describe('Configured keys tracking', () => {
      it('uses temporary directory for tests', () => {
        // Verify we're not using the real home directory
        const configPath = getConfigPath();
        expect(configPath).toContain(tempHome);
        expect(configPath).not.toContain(originalHome || '');
      });

      it('returns empty array when no config file exists', () => {
        const keys = getConfiguredKeys();

        expect(keys).toEqual([]);
      });

      it('returns configured keys from config file', () => {
        saveAnthropicConfig({
          key: 'sk-ant-api03-' + 'A'.repeat(95),
          model: AnthropicModel.Haiku,
        });

        const keys = getConfiguredKeys();

        expect(keys).toContain('anthropic.key');
        expect(keys).toContain('anthropic.model');
      });

      it('returns optional configured keys', () => {
        saveAnthropicConfig({
          key: 'sk-ant-api03-' + 'A'.repeat(95),
          model: AnthropicModel.Haiku,
        });
        saveDebugSetting(true);

        const keys = getConfiguredKeys();

        expect(keys).toContain('anthropic.key');
        expect(keys).toContain('anthropic.model');
        expect(keys).toContain('settings.debug');
      });

      it('returns discovered keys from config file', () => {
        saveConfig('custom', { mykey: 'myvalue' });

        const keys = getConfiguredKeys();

        expect(keys).toContain('custom.mykey');
      });

      it('handles nested config structures', () => {
        saveConfig('product', {
          alpha: { path: '/path/to/alpha', enabled: true },
          beta: { path: '/path/to/beta', enabled: false },
        });

        const keys = getConfiguredKeys();

        expect(keys).toContain('product.alpha.path');
        expect(keys).toContain('product.alpha.enabled');
        expect(keys).toContain('product.beta.path');
        expect(keys).toContain('product.beta.enabled');
      });

      it('returns all keys from mixed configuration', () => {
        // Required config
        saveAnthropicConfig({
          key: 'sk-ant-api03-' + 'A'.repeat(95),
          model: AnthropicModel.Haiku,
        });
        // Optional config
        saveDebugSetting(true);
        // Discovered config
        saveConfig('custom', { setting: 'value' });

        const keys = getConfiguredKeys();

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
        const steps = createConfigStepsFromSchema(['anthropic.key']);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Text);
        expect(steps[0].key).toBe('key');
        expect(steps[0].description).toBe('Anthropic API key');
      });

      it('creates selection step for enum type', () => {
        const steps = createConfigStepsFromSchema(['anthropic.model']);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Selection);
        expect(steps[0].key).toBe('model');
      });

      it('creates selection step for boolean type', () => {
        const steps = createConfigStepsFromSchema(['settings.debug']);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Selection);
        expect(steps[0].key).toBe('debug');
        expect(steps[0].description).toBe('Debug mode');
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
        saveAnthropicConfig({
          key: 'sk-ant-api03-' + 'a'.repeat(95),
          model: AnthropicModel.Haiku,
        });

        const steps = createConfigStepsFromSchema([
          'anthropic.key',
          'anthropic.model',
        ]);

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
        saveConfig('custom', { mykey: 'myvalue' });

        const steps = createConfigStepsFromSchema(['custom.mykey']);

        expect(steps).toHaveLength(1);
        expect(steps[0].type).toBe(StepType.Text);
        expect(steps[0].key).toBe('mykey');
        expect(steps[0].path).toBe('custom.mykey');
        expect(steps[0].description).toBe('custom.mykey');
      });

      it('loads existing values for discovered config keys', () => {
        // Save config with discovered keys
        saveConfig('opera', {
          gx: { repo: '~/Developer/gx' },
          neon: { repo: '~/Developer/neon' },
        });

        const steps = createConfigStepsFromSchema([
          'opera.gx.repo',
          'opera.neon.repo',
        ]);

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
        const steps = createConfigStepsFromSchema(['nonexistent.key']);

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
