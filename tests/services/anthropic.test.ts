import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hasValidAnthropicKey,
  saveAnthropicConfig,
} from '../../src/services/config.js';

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
      saveAnthropicConfig({
        key: '',
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
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
