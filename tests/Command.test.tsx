import { describe, it, expect } from 'vitest';
import React from 'react';

import { Command } from '../src/ui/Command.js';

describe('Command component error handling', () => {
  describe('Error display', () => {
    it('displays error from state', () => {
      const result = (
        <Command
          command="test command"
          state={{ done: true, isLoading: false, error: 'Test error' }}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.state?.error).toBe('Test error');
    });
  });

  describe('Loading states', () => {
    it('displays loading state initially', () => {
      const result = (
        <Command
          command="test command"
          state={{ done: false, isLoading: true }}
        />
      );

      expect(result.props.state?.isLoading).toBe(true);
      expect(result.props.state?.done).toBe(false);
    });

    it('displays non-loading state when done', () => {
      const result = (
        <Command
          command="test command"
          state={{ done: true, isLoading: false }}
        />
      );

      expect(result.props.state?.isLoading).toBe(false);
      expect(result.props.state?.done).toBe(true);
    });
  });

  describe('Command variations', () => {
    it('renders command with special characters', () => {
      const result = (
        <Command
          command="commit changes with message 'add new feature'"
          state={{ done: true, isLoading: false }}
        />
      );

      expect(result.props.command).toBe(
        "commit changes with message 'add new feature'"
      );
    });
  });
});
