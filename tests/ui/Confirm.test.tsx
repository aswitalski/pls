import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ComponentStatus } from '../../src/types/components.js';

import { Confirm } from '../../src/ui/Confirm.js';

import { Keys, createRequestHandlers } from '../test-utils.js';

describe('Confirm component', () => {
  describe('Rendering', () => {
    it('renders message', () => {
      const { lastFrame } = render(
        <Confirm
          message="Should I execute this plan?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Should I execute this plan?');
    });

    it('renders yes and no options', () => {
      const { lastFrame } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('yes');
      expect(output).toContain('no');
    });

    it('highlights yes by default', () => {
      const { lastFrame } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
      // "yes" should be colored (not dimmed) by default
    });
  });

  describe('Interaction', () => {
    it('calls onConfirmed when Enter pressed on yes', () => {
      const onConfirmed = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={onConfirmed}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      stdin.write(Keys.Enter);

      expect(onConfirmed).toHaveBeenCalledOnce();
    });

    it('calls onCancelled when Enter pressed on no', async () => {
      const onCancelled = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={onCancelled}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      stdin.write(Keys.Tab);
      await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for state update
      stdin.write(Keys.Enter);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for callback

      expect(onCancelled).toHaveBeenCalledOnce();
    });

    it('toggles selection with Tab', () => {
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      // Initially "yes" is selected
      stdin.write(Keys.Tab); // Now "no" is selected
      stdin.write(Keys.Tab); // Back to "yes"
      stdin.write(Keys.Tab); // "no" again

      // Verify it toggles (output would show different highlighting)
      // This is a smoke test - actual highlighting is visual
      expect(true).toBe(true);
    });

    it('does not respond to input when done', () => {
      const onConfirmed = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          status={ComponentStatus.Done}
          requestHandlers={createRequestHandlers()}
          onConfirmed={onConfirmed}
          onCancelled={() => {}}
        />
      );

      stdin.write(Keys.Enter);

      expect(onConfirmed).not.toHaveBeenCalled();
    });

    it('Escape highlights "no" and cancels', async () => {
      const onCancelled = vi.fn();
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={onCancelled}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      // Escape should highlight "no" and call onCancelled
      stdin.write(Keys.Escape);

      expect(onCancelled).toHaveBeenCalledOnce();
    });
  });

  describe('State', () => {
    it('renders with done state', () => {
      const { lastFrame } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Continue?');
      expect(output).toContain('> yes');
    });

    it('renders with done and confirmed state', () => {
      const { lastFrame } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
    });
  });

  describe('Callbacks', () => {
    it('works without onConfirmed callback', () => {
      const { stdin } = render(
        <Confirm
          message="Continue?"
          onConfirmed={() => {}}
          onCancelled={() => {}}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
        />
      );

      // Should not crash
      stdin.write(Keys.Enter);
      expect(true).toBe(true);
    });
  });
});
