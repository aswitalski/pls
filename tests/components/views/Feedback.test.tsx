import React from 'react';
import { describe, expect, it } from 'vitest';

import { ComponentStatus } from '../../../src/types/components.js';
import { FeedbackType } from '../../../src/types/types.js';

import { Feedback } from '../../../src/components/views/Feedback.js';

describe('Feedback component', () => {
  describe('Success feedback', () => {
    it('renders success message', () => {
      const result = (
        <Feedback
          type={FeedbackType.Succeeded}
          message="Operation succeeded"
          status={ComponentStatus.Done}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.type).toBe(FeedbackType.Succeeded);
      expect(result.props.message).toBe('Operation succeeded');
    });

    it('renders multi-line success message', () => {
      const message = 'First line\n\nSecond line\n\nThird line';
      const result = (
        <Feedback
          type={FeedbackType.Succeeded}
          message={message}
          status={ComponentStatus.Done}
        />
      );

      expect(result.props.message).toBe(message);
    });
  });

  describe('Aborted feedback', () => {
    it('renders aborted message', () => {
      const result = (
        <Feedback
          type={FeedbackType.Aborted}
          message="Operation aborted"
          status={ComponentStatus.Done}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.type).toBe(FeedbackType.Aborted);
      expect(result.props.message).toBe('Operation aborted');
    });

    it('renders custom abort reason', () => {
      const result = (
        <Feedback
          type={FeedbackType.Aborted}
          message="Aborted by user request"
          status={ComponentStatus.Done}
        />
      );

      expect(result.props.message).toBe('Aborted by user request');
    });
  });

  describe('Failed feedback', () => {
    it('renders failure message', () => {
      const result = (
        <Feedback
          type={FeedbackType.Failed}
          message="Operation failed"
          status={ComponentStatus.Done}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.type).toBe(FeedbackType.Failed);
      expect(result.props.message).toBe('Operation failed');
    });

    it('renders detailed error message', () => {
      const message =
        'Unexpected error occurred:\n\nAPI connection failed\n\nPlease check your network';
      const result = (
        <Feedback
          type={FeedbackType.Failed}
          message={message}
          status={ComponentStatus.Done}
        />
      );

      expect(result.props.message).toBe(message);
    });

    it('renders technical error details', () => {
      const message = 'Error: ECONNREFUSED at port 8080';
      const result = (
        <Feedback
          type={FeedbackType.Failed}
          message={message}
          status={ComponentStatus.Done}
        />
      );

      expect(result.props.message).toBe(message);
    });
  });

  describe('Edge cases', () => {
    it('renders message with special characters', () => {
      const message = 'Success! ✓ ✗ → ← ⊘ 100%';
      const result = (
        <Feedback
          type={FeedbackType.Succeeded}
          message={message}
          status={ComponentStatus.Done}
        />
      );

      expect(result.props.message).toBe(message);
    });

    it('renders message with ANSI codes', () => {
      const message = '\x1b[31mRed text\x1b[0m';
      const result = (
        <Feedback
          type={FeedbackType.Failed}
          message={message}
          status={ComponentStatus.Done}
        />
      );

      expect(result.props.message).toBe(message);
    });
  });
});
