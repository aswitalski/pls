import { describe, it, expect } from 'vitest';
import { mergeConfig } from '../src/services/config.js';

describe('mergeConfig', () => {
  it('creates new config when file is empty', () => {
    const result = mergeConfig('', 'anthropic', {
      'api-key': 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
    });

    expect(result).toContain('anthropic:');
    expect(result).toContain('  api-key: sk-ant-test');
    expect(result).toContain('  model: claude-haiku-4-5-20251001');
  });

  it('adds new section to existing config', () => {
    const existing = `ui:
  theme: dark
  verbose: true`;

    const result = mergeConfig(existing, 'anthropic', {
      'api-key': 'sk-ant-test',
      model: 'claude-haiku-4-5-20251001',
    });

    expect(result).toContain('ui:');
    expect(result).toContain('  theme: dark');
    expect(result).toContain('anthropic:');
    expect(result).toContain('  api-key: sk-ant-test');
  });

  it('sorts sections alphabetically', () => {
    const existing = `ui:
  theme: dark`;

    const result = mergeConfig(existing, 'anthropic', {
      'api-key': 'sk-ant-test',
    });

    const anthropicIndex = result.indexOf('anthropic:');
    const uiIndex = result.indexOf('ui:');

    expect(anthropicIndex).toBeLessThan(uiIndex);
  });

  it('updates existing section without removing other keys', () => {
    const existing = `anthropic:
  api-key: sk-ant-old
  custom-setting: value`;

    const result = mergeConfig(existing, 'anthropic', {
      'api-key': 'sk-ant-new',
      model: 'claude-haiku-4-5-20251001',
    });

    expect(result).toContain('api-key: sk-ant-new');
    expect(result).toContain('model: claude-haiku-4-5-20251001');
    expect(result).toContain('custom-setting: value');
    expect(result).not.toContain('sk-ant-old');
  });

  it('adds empty line before new section', () => {
    const existing = `ui:
  theme: dark`;

    const result = mergeConfig(existing, 'anthropic', {
      'api-key': 'sk-ant-test',
    });

    expect(result).toMatch(/anthropic:\n {2}api-key:/);
    expect(result).toMatch(/ui:\n {2}theme:/);
  });

  it('handles multiple sections with sorting', () => {
    const existing = `ui:
  theme: dark

config:
  llm: anthropic
  name: Sensei`;

    const result = mergeConfig(existing, 'anthropic', {
      'api-key': 'sk-ant-test',
    });

    const sections = result.match(/^[a-z]+:/gm) || [];
    expect(sections).toEqual(['anthropic:', 'config:', 'ui:']);
  });

  it('updates key in existing section', () => {
    const existing = `anthropic:
  api-key: sk-ant-old
  model: old-model`;

    const result = mergeConfig(existing, 'anthropic', {
      model: 'new-model',
    });

    expect(result).toContain('api-key: sk-ant-old');
    expect(result).toContain('model: new-model');
    expect(result).not.toContain('old-model');
  });
});
