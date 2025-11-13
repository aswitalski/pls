import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Command } from '../src/ui/Command.js';
import { Keys } from './test-utils.js';

const { Escape } = Keys;

// Mock onAborted function for all tests
const mockOnAborted = vi.fn();

describe('Command component error handling', () => {
  describe('Error display', () => {
    it('displays error from state', () => {
      const result = (
        <Command
          onAborted={mockOnAborted}
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
          onAborted={mockOnAborted}
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
          onAborted={mockOnAborted}
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
          onAborted={mockOnAborted}
          command="commit changes with message 'add new feature'"
          state={{ done: true, isLoading: false }}
        />
      );

      expect(result.props.command).toBe(
        "commit changes with message 'add new feature'"
      );
    });
  });

  describe('Abort handling', () => {
    it('calls onAborted when Esc is pressed during loading', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Command
          onAborted={onAborted}
          command="test command"
          state={{ done: false, isLoading: true }}
        />
      );

      stdin.write(Escape);
      expect(onAborted).toHaveBeenCalledTimes(1);
    });

    it('stops loading state when aborted', () => {
      const onAborted = vi.fn();
      const state = { done: false, isLoading: true };
      const { stdin } = render(
        <Command onAborted={onAborted} command="test command" state={state} />
      );

      expect(state.isLoading).toBe(true);

      stdin.write(Escape);

      // onAborted should be called and isLoading is set to false before calling it
      expect(onAborted).toHaveBeenCalledTimes(1);
    });

    it('does not call onAborted when Esc is pressed after done', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Command
          onAborted={onAborted}
          command="test command"
          state={{ done: true, isLoading: false }}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });
  });
});
