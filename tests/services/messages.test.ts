import { describe, expect, it } from 'vitest';

import {
  FeedbackMessages,
  getCancellationMessage,
  getConfirmationMessage,
  getRefiningMessage,
} from '../../src/services/messages.js';

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
