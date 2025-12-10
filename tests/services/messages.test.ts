import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  DebugLevel,
  saveDebugSetting,
} from '../../src/services/configuration.js';
import {
  FeedbackMessages,
  formatErrorMessage,
  getCancellationMessage,
  getConfirmationMessage,
  getRefiningMessage,
} from '../../src/services/messages.js';

import { safeRemoveDirectory } from '../test-utils.js';

describe('formatErrorMessage', () => {
  let testDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `pls-test-${Date.now().toString()}-${Math.random().toString()}`
    );
    mkdirSync(testDir, { recursive: true });
    originalHome = process.env.HOME;
    process.env.HOME = testDir;
    // Create minimal valid config so loadDebugSetting can load settings
    const configPath = join(testDir, '.plsrc');
    writeFileSync(
      configPath,
      'anthropic:\n  key: sk-ant-api03-' + 'x'.repeat(95) + '\n',
      'utf-8'
    );
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    safeRemoveDirectory(testDir);
  });

  describe('in normal mode', () => {
    beforeEach(() => {
      saveDebugSetting(DebugLevel.None);
    });

    it('extracts message from Anthropic API error format', () => {
      const apiError = new Error(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}'
      );
      expect(formatErrorMessage(apiError)).toBe(
        'Your credit balance is too low'
      );
    });

    it('extracts message from nested error object', () => {
      const apiError = new Error(
        '{"type":"error","error":{"message":"Invalid API key"}}'
      );
      expect(formatErrorMessage(apiError)).toBe('Invalid API key');
    });

    it('extracts message from top-level message field', () => {
      const apiError = new Error('{"message":"Rate limit exceeded"}');
      expect(formatErrorMessage(apiError)).toBe('Rate limit exceeded');
    });

    it('returns original message for plain text errors', () => {
      const plainError = new Error('Connection refused');
      expect(formatErrorMessage(plainError)).toBe('Connection refused');
    });

    it('returns original message for malformed JSON', () => {
      const malformedError = new Error('400 {invalid json}');
      expect(formatErrorMessage(malformedError)).toBe('400 {invalid json}');
    });

    it('returns original message when JSON has no message field', () => {
      const noMessageError = new Error('{"type":"error","code":500}');
      expect(formatErrorMessage(noMessageError)).toBe(
        '{"type":"error","code":500}'
      );
    });

    it('returns default message for non-Error objects', () => {
      expect(formatErrorMessage('string error')).toBe('Unknown error occurred');
      expect(formatErrorMessage(null)).toBe('Unknown error occurred');
      expect(formatErrorMessage(undefined)).toBe('Unknown error occurred');
      expect(formatErrorMessage(42)).toBe('Unknown error occurred');
    });
  });

  describe('in debug mode', () => {
    beforeEach(() => {
      saveDebugSetting(DebugLevel.Info);
    });

    it('returns full error message including JSON', () => {
      const apiError = new Error(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}'
      );
      expect(formatErrorMessage(apiError)).toBe(
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low"}}'
      );
    });

    it('returns full plain text error message', () => {
      const plainError = new Error('Connection refused');
      expect(formatErrorMessage(plainError)).toBe('Connection refused');
    });

    it('returns default message for non-Error objects', () => {
      expect(formatErrorMessage('string error')).toBe('Unknown error occurred');
    });
  });
});

describe('Message functions', () => {
  describe('getConfirmationMessage', () => {
    const expectedMessages = [
      'Should I execute this plan?',
      'Do you want me to proceed with these tasks?',
      'Ready to execute?',
      'Shall I execute this plan?',
      'Would you like me to run these tasks?',
      'Execute this plan?',
    ];

    it('returns one of the expected messages', () => {
      const message = getConfirmationMessage();
      expect(expectedMessages).toContain(message);
    });

    it('returns a string ending with a question mark', () => {
      const message = getConfirmationMessage();
      expect(message).toMatch(/\?$/);
    });

    it('varies messages across multiple calls', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 50; i++) {
        messages.add(getConfirmationMessage());
      }
      expect(messages.size).toBeGreaterThan(1);
    });
  });

  describe('getRefiningMessage', () => {
    const expectedMessages = [
      'Let me work out the specifics for you.',
      "I'll figure out the concrete steps.",
      'Let me break this down into tasks.',
      "I'll plan out the details.",
      'Let me arrange the steps.',
      "I'll prepare everything you need.",
    ];

    it('returns one of the expected messages', () => {
      const message = getRefiningMessage();
      expect(expectedMessages).toContain(message);
    });

    it('returns a string ending with a period', () => {
      const message = getRefiningMessage();
      expect(message).toMatch(/\.$/);
    });

    it('varies messages across multiple calls', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 50; i++) {
        messages.add(getRefiningMessage());
      }
      expect(messages.size).toBeGreaterThan(1);
    });
  });

  describe('getCancellationMessage', () => {
    it('returns a message with the operation name', () => {
      const message = getCancellationMessage('execution');
      expect(message).toMatch(/execution/);
    });

    it('lowercases the operation name', () => {
      const message = getCancellationMessage('EXECUTION');
      expect(message).toMatch(/execution/);
      expect(message).not.toMatch(/EXECUTION/);
    });

    it('returns a string ending with a period', () => {
      const message = getCancellationMessage('execution');
      expect(message).toMatch(/\.$/);
    });

    it('returns one of four expected patterns', () => {
      const message = getCancellationMessage('test');
      const patterns = [
        /^I've cancelled the test\.$/,
        /^I've aborted the test\.$/,
        /^The test was cancelled\.$/,
        /^The test has been aborted\.$/,
      ];
      expect(patterns.some((pattern) => pattern.test(message))).toBe(true);
    });

    it('varies messages across multiple calls', () => {
      const messages = new Set<string>();
      for (let i = 0; i < 50; i++) {
        messages.add(getCancellationMessage('operation'));
      }
      expect(messages.size).toBeGreaterThan(1);
    });

    it('handles different operation names correctly', () => {
      expect(getCancellationMessage('execution')).toMatch(/execution/);
      expect(getCancellationMessage('task selection')).toMatch(
        /task selection/
      );
      expect(getCancellationMessage('introspection')).toMatch(/introspection/);
    });
  });

  describe('FeedbackMessages', () => {
    it('has ConfigurationComplete message', () => {
      expect(FeedbackMessages.ConfigurationComplete).toBe(
        'Configuration complete.'
      );
    });

    it('has UnexpectedError message', () => {
      expect(FeedbackMessages.UnexpectedError).toBe(
        'Unexpected error occurred:'
      );
    });

    it('ConfigurationComplete ends with a period', () => {
      expect(FeedbackMessages.ConfigurationComplete).toMatch(/\.$/);
    });

    it('UnexpectedError ends with a colon', () => {
      expect(FeedbackMessages.UnexpectedError).toMatch(/:$/);
    });
  });
});
