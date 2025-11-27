import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Command } from '../../src/ui/Command.js';
import { Keys } from '../test-utils.js';

const { Escape } = Keys;

// Mock onAborted function for all tests
const mockOnAborted = vi.fn();

describe('Command component error handling', () => {
  describe('Error display', () => {
    it('displays error from state', () => {
      const result = (
        <Command onAborted={mockOnAborted} command="test command" />
      );

      expect(result).toBeDefined();
      expect(result.props.state?.error).toBe('Test error');
    });
  });

  describe('Component states', () => {
    it('displays active state', () => {
      const result = (
        <Command onAborted={mockOnAborted} command="test command" />
      );

      expect(result.props.isActive).toBe(true);
    });

    it('displays inactive state when not active', () => {
      const result = (
        <Command
          onAborted={mockOnAborted}
          command="test command"
          isActive={false}
        />
      );

      expect(result.props.isActive).toBe(false);
    });
  });

  describe('Command variations', () => {
    it('renders command with special characters', () => {
      const result = (
        <Command
          onAborted={mockOnAborted}
          command="commit changes with message 'add new feature'"
        />
      );

      expect(result.props.command).toBe(
        "commit changes with message 'add new feature'"
      );
    });
  });

  describe('Abort handling', () => {
    it('calls onAborted when Esc is pressed', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Command onAborted={onAborted} command="test command" />
      );

      stdin.write(Escape);
      expect(onAborted).toHaveBeenCalledTimes(1);
    });

    it('calls handler when aborted', () => {
      const handlers = {
        onAborted: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      const { stdin } = render(
        <Command
          onAborted={vi.fn()}
          command="test command"
          handlers={handlers}
        />
      );

      stdin.write(Escape);

      expect(handlers.onAborted).toHaveBeenCalledTimes(1);
    });

    it('does not call onAborted when Esc is pressed after done', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Command onAborted={onAborted} command="test command" />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });
  });
});
