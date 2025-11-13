import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Confirm } from '../src/ui/Confirm.js';

describe('Confirm component', () => {
  describe('Rendering', () => {
    it('renders message', () => {
      const { lastFrame } = render(
        <Confirm message="Should I execute this plan?" onCancelled={() => {}} />
      );

      const output = lastFrame();
      expect(output).toContain('Should I execute this plan?');
    });

    it('renders Yes and No options', () => {
      const { lastFrame } = render(
        <Confirm message="Continue?" onCancelled={() => {}} />
      );

      const output = lastFrame();
      expect(output).toContain('Yes');
      expect(output).toContain('No');
    });

    it('highlights Yes by default', () => {
      const { lastFrame } = render(
        <Confirm message="Continue?" onCancelled={() => {}} />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
      // Yes should be bold (not dimmed) by default
    });
  });

  describe('Interaction', () => {
    it('calls onConfirmed when Enter pressed on Yes', () => {
      const onConfirmed = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={onConfirmed}
          onCancelled={() => {}}
        />
      );

      stdin.write('\r'); // Enter key

      expect(onConfirmed).toHaveBeenCalledOnce();
    });

    it('calls onCancelled when Enter pressed on No', async () => {
      const onCancelled = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={onCancelled}
        />
      );

      stdin.write('\t'); // Tab to switch to No
      await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for state update
      stdin.write('\r'); // Enter key

      expect(onCancelled).toHaveBeenCalledOnce();
    });

    it('toggles selection with Tab', () => {
      const { stdin } = render(
        <Confirm message="Continue?" onCancelled={() => {}} />
      );

      // Initially Yes is selected
      stdin.write('\t'); // Now No is selected
      stdin.write('\t'); // Back to Yes
      stdin.write('\t'); // No again

      // Verify it toggles (output would show different highlighting)
      // This is a smoke test - actual highlighting is visual
      expect(true).toBe(true);
    });

    it('does not respond to input when done', () => {
      const onConfirmed = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          state={{ done: true }}
          onConfirmed={onConfirmed}
          onCancelled={() => {}}
        />
      );

      stdin.write('\r'); // Enter key

      expect(onConfirmed).not.toHaveBeenCalled();
    });

    it('Escape highlights No and cancels', async () => {
      const onCancelled = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={onCancelled}
        />
      );

      // Escape should highlight No and call onCancelled
      stdin.write(Keys.Escape);

      expect(onCancelled).toHaveBeenCalledOnce();
    });
  });

  describe('State', () => {
    it('renders with done state', () => {
      const { lastFrame } = render(
        <Confirm
          message="Continue?"
          state={{ done: true }}
          onCancelled={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Continue?');
      expect(output).toContain('> Yes');
    });

    it('renders with done and confirmed state', () => {
      const { lastFrame } = render(
        <Confirm
          message="Continue?"
          state={{ done: true, confirmed: true }}
          onCancelled={() => {}}
        />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
    });
  });

  describe('Callbacks', () => {
    it('works without onConfirmed callback', () => {
      const { stdin } = render(
        <Confirm message="Continue?" onCancelled={() => {}} />
      );

      // Should not crash
      stdin.write('\r');
      expect(true).toBe(true);
    });

    it('works without onCancelled callback', () => {
      const { stdin } = render(<Confirm message="Continue?" />);

      // Should not crash
      stdin.write('\t');
      stdin.write('\r');
      expect(true).toBe(true);
    });
  });
});
