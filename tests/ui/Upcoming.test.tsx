import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { Upcoming } from '../../src/components/views/Upcoming.js';
import { ExecutionStatus } from '../../src/services/shell.js';

describe('Upcoming component', () => {
  describe('Rendering', () => {
    it('renders nothing when items array is empty', () => {
      const { lastFrame } = render(<Upcoming items={[]} />);

      expect(lastFrame()).toBe('');
    });

    it('renders Next: label with single item', () => {
      const { lastFrame } = render(<Upcoming items={['Task A']} />);

      const output = lastFrame();
      expect(output).toContain('Next:');
      expect(output).toContain('Task A');
    });

    it('renders multiple items', () => {
      const { lastFrame } = render(
        <Upcoming items={['Task A', 'Task B', 'Task C']} />
      );

      const output = lastFrame();
      expect(output).toContain('Next:');
      expect(output).toContain('Task A');
      expect(output).toContain('Task B');
      expect(output).toContain('Task C');
    });
  });

  describe('Tree symbols', () => {
    it('uses last branch symbol for single item', () => {
      const { lastFrame } = render(<Upcoming items={['Only Task']} />);

      const output = lastFrame();
      expect(output).toContain('└─ Only Task');
    });

    it('uses middle branch for non-last items and last branch for final item', () => {
      const { lastFrame } = render(
        <Upcoming items={['First', 'Second', 'Third']} />
      );

      const output = lastFrame();
      expect(output).toContain('├─ First');
      expect(output).toContain('├─ Second');
      expect(output).toContain('└─ Third');
    });

    it('uses correct symbols for two items', () => {
      const { lastFrame } = render(<Upcoming items={['Alpha', 'Beta']} />);

      const output = lastFrame();
      expect(output).toContain('├─ Alpha');
      expect(output).toContain('└─ Beta');
    });
  });

  describe('Status handling', () => {
    it('shows Next: label when pending', () => {
      const { lastFrame } = render(
        <Upcoming
          items={['Task A', 'Task B']}
          status={ExecutionStatus.Pending}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Next:');
    });

    it('shows Skipped: label when failed', () => {
      const { lastFrame } = render(
        <Upcoming
          items={['Task A', 'Task B']}
          status={ExecutionStatus.Failed}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Skipped:');
    });

    it('shows Cancelled: label when aborted', () => {
      const { lastFrame } = render(
        <Upcoming
          items={['Task A', 'Task B']}
          status={ExecutionStatus.Aborted}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Cancelled:');
    });

    it('defaults to pending status', () => {
      const { lastFrame } = render(<Upcoming items={['Task A']} />);

      const output = lastFrame();
      expect(output).toContain('Next:');
    });
  });
});
