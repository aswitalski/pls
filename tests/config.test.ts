import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  mergeConfig,
  configExists,
  loadConfig,
  saveConfig,
  saveAnthropicConfig,
  ConfigError,
} from '../src/services/config.js';
import { safeRemoveDirectory } from './test-utils.js';

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
        model: 'claude-haiku-4-5-20251001',
      });

      const config = loadConfig();
      expect(config.anthropic.key).toBe('sk-ant-test');
      expect(config.anthropic.model).toBe('claude-haiku-4-5-20251001');
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
});
