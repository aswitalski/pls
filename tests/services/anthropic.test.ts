import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanAnswerText } from '../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  saveAnthropicConfig,
} from '../../src/services/configuration.js';
import { loadFragment } from '../../src/services/tool-registry.js';

import { safeRemoveDirectory } from '../test-utils.js';

describe('Anthropic API key validation', () => {
  let originalHome: string | undefined;
  let tempHome: string;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = join(
      tmpdir(),
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `pls-anthropic-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempHome, { recursive: true });
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    safeRemoveDirectory(tempHome);
  });

  describe('Valid API keys', () => {
    it('accepts valid API key with uppercase letters', () => {
      const validKey = 'sk-ant-api03-' + 'A'.repeat(95);

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with lowercase letters', () => {
      const validKey = 'sk-ant-api03-' + 'a'.repeat(95);

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with digits', () => {
      const validKey = 'sk-ant-api03-' + '0123456789'.repeat(9) + '01234';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with hyphens', () => {
      const validKey = 'sk-ant-api03-' + 'A-'.repeat(47) + 'A';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with underscores', () => {
      const validKey = 'sk-ant-api03-' + 'A_'.repeat(47) + 'A';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with mixed characters', () => {
      const validKey = 'sk-ant-api03-' + 'aB3-xY9_Z'.repeat(10) + 'mN2-p';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });
  });

  describe('Invalid API keys', () => {
    it('rejects invalid API key format without sk-ant-api03- prefix', () => {
      saveAnthropicConfig({
        key: 'invalid-key-format',
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key with old sk-ant- prefix format', () => {
      saveAnthropicConfig({
        key: 'sk-ant-' + 'A'.repeat(95),
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key that is too short', () => {
      saveAnthropicConfig({
        key: 'sk-ant-api03-',
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key that is too long', () => {
      const tooLongKey = 'sk-ant-api03-' + 'A'.repeat(96);
      saveAnthropicConfig({
        key: tooLongKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key with special characters in body', () => {
      const invalidKey = 'sk-ant-api03-' + 'A'.repeat(90) + '@#$%^';
      expect(invalidKey.length).toBe(108);

      saveAnthropicConfig({
        key: invalidKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects empty API key', () => {
      expect(() =>
        saveAnthropicConfig({
          key: '',
          model: 'claude-haiku-4-5-20251001',
        })
      ).toThrow('Missing or invalid API key');
    });

    it('rejects API key with correct length but wrong prefix', () => {
      const wrongPrefix = 'sk-wrong-api-' + 'A'.repeat(95);
      saveAnthropicConfig({
        key: wrongPrefix,
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });
  });
});

describe('Answer text cleaning', () => {
  it('removes simple citation tags', () => {
    const input = '<cite index="1-1">Some content</cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe('Some content');
  });

  it('removes multiple citation tags', () => {
    const input =
      '<cite index="1-1">First</cite> and <cite index="2-1">second</cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe('First and second');
  });

  it('removes citation tags from complex text', () => {
    const input =
      '<cite index="1-1">Rumination is the focused attention on the symptoms of one\'s mental distress.</cite> <cite index="2-1">It involves repetitive thinking or dwelling on negative feelings and distress and their causes and consequences.</cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe(
      "Rumination is the focused attention on the symptoms of one's mental distress. It\ninvolves repetitive thinking or dwelling on negative feelings and distress and\ntheir causes and consequences."
    );
  });

  it('removes other HTML/XML tags', () => {
    const input = '<strong>Bold text</strong> and <em>italic text</em>';
    const result = cleanAnswerText(input);
    expect(result).toBe('Bold text and italic text');
  });

  it('normalizes whitespace', () => {
    const input = 'Some    text   with   extra    spaces';
    const result = cleanAnswerText(input);
    expect(result).toBe('Some text with extra spaces');
  });

  it('handles text without any tags', () => {
    const input = 'Plain text without any markup';
    const result = cleanAnswerText(input);
    expect(result).toBe('Plain text without any markup');
  });

  it('handles empty string', () => {
    const input = '';
    const result = cleanAnswerText(input);
    expect(result).toBe('');
  });

  it('handles nested tags', () => {
    const input = '<cite index="1-1"><strong>Bold citation</strong></cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe('Bold citation');
  });

  it('wraps long lines to 80 characters', () => {
    const input =
      'This is a very long line that exceeds eighty characters and should be wrapped to multiple lines for better readability in the terminal.';
    const result = cleanAnswerText(input);
    const lines = result.split('\n');
    expect(lines.every((line) => line.length <= 80)).toBe(true);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('combines citation tags and wraps text', () => {
    const input = `<cite index="1-1">First line with some content</cite>
<cite index="2-1">Second line with more content</cite>
<cite index="3-1">Third line with additional content</cite>`;
    const result = cleanAnswerText(input);
    const lines = result.split('\n');
    // All lines should be <= 80 chars
    expect(lines.every((line) => line.length <= 80)).toBe(true);
    // Should contain all the content (may be wrapped across lines)
    expect(result).toContain('First line with some content');
    expect(result).toContain('Second line with more content');
    expect(result).toContain('Third line with');
    expect(result).toContain('additional content');
  });
});

describe('PLAN fragment loading', () => {
  it('loads foundation fragment', () => {
    const content = loadFragment('PLAN/foundation.md');
    expect(content).toBeTruthy();
    expect(content).toContain('## Overview');
  });

  it('loads routing fragment', () => {
    const content = loadFragment('PLAN/routing.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Core Status Items');
  });

  it('loads tasks fragment', () => {
    const content = loadFragment('PLAN/tasks.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Task Definition Guidelines');
  });

  it('loads config fragment', () => {
    const content = loadFragment('PLAN/config.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Configuration Requests');
  });

  it('loads splitting fragment', () => {
    const content = loadFragment('PLAN/splitting.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Multiple Tasks');
  });

  it('loads examples-core fragment', () => {
    const content = loadFragment('PLAN/examples-core.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Examples');
  });

  it('loads skills fragment', () => {
    const content = loadFragment('PLAN/skills.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Skills Integration');
  });

  it('loads examples-skills fragment', () => {
    const content = loadFragment('PLAN/examples-skills.md');
    expect(content).toBeTruthy();
    expect(content).toContain('Skill-Based');
  });
});
