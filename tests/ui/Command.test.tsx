import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Command } from '../../src/ui/Command.js';
import { Keys, createMockHandlers } from '../test-utils.js';

const { Escape } = Keys;

// Mock onAborted function for all tests
const mockOnAborted = vi.fn();

describe('Command component error handling', () => {
  describe('Error display', () => {
    it('displays error from state', () => {
      const { lastFrame } = render(
        <Command
          command="test command"
          state={{ error: 'Test error' }}
          isActive={false}
        />
      );

      expect(lastFrame()).toContain('Error: Test error');
    });
  });

  describe('Component states', () => {
    it('displays active state with spinner', () => {
      const { lastFrame } = render(<Command command="test command" />);

      // Active command shows spinner
      expect(lastFrame()).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    it('displays inactive state without spinner', () => {
      const { lastFrame } = render(
        <Command command="test command" isActive={false} />
      );

      // Inactive command should not show spinner
      expect(lastFrame()).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });
  });

  describe('Command variations', () => {
    it('renders command with special characters', () => {
      const { lastFrame } = render(
        <Command command="commit changes with message 'add new feature'" />
      );

      // Command should render without errors
      expect(lastFrame()).toBeDefined();
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
      const handlers = createMockHandlers();
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
        <Command
          onAborted={onAborted}
          command="test command"
          isActive={false}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });
  });
});
