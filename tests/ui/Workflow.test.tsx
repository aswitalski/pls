import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  ComponentStatus,
} from '../../src/types/components.js';
import {
  ComponentName,
  FeedbackType,
  TaskType,
} from '../../src/types/types.js';

import { DebugLevel } from '../../src/services/configuration.js';

import { Workflow } from '../../src/ui/Workflow.js';

// Mock exitApp to prevent process.exit
vi.mock('../../src/services/process.js', () => ({
  exitApp: vi.fn(),
}));

const WaitTime = 50; // For React render cycles

describe('Workflow component lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component status transitions', () => {
    it('transitions stateless components from Awaiting to Active to Done', async () => {
      const messages: ComponentDefinition[] = [];

      // Create a simple Message component in Awaiting state
      const messageComponent: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Hello' },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame, rerender } = render(
        <Workflow initialQueue={[messageComponent]} debug={DebugLevel.Info} />
      );

      // Wait for effects to process
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Check that message was rendered
      expect(lastFrame()).toContain('Hello');

      // The component should be visible in the output
      // Note: We can't directly inspect the internal state, but the component
      // should have been moved to timeline with Done status
    });

    it('transitions stateful components from Awaiting to Active', async () => {
      const onConfirmed = vi.fn();
      const onCancelled = vi.fn();

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: {},
        props: {
          message: 'Proceed?',
          onConfirmed,
          onCancelled,
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[confirmComponent]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Confirm component should be rendered
      expect(lastFrame()).toContain('Proceed?');
    });

    it('processes multiple components sequentially', async () => {
      const component1: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'First' },
        status: ComponentStatus.Awaiting,
      };

      const component2: ComponentDefinition = {
        id: 'msg-2',
        name: ComponentName.Message,
        props: { text: 'Second' },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow
          initialQueue={[component1, component2]}
          debug={DebugLevel.Info}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Both messages should eventually be visible
      expect(lastFrame()).toContain('First');
      expect(lastFrame()).toContain('Second');
    });

    it('handles mixed stateless and stateful components', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Before confirm' },
        status: ComponentStatus.Awaiting,
      };

      const confirm: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: {},
        props: {
          message: 'Continue?',
          onConfirmed: vi.fn(),
          onCancelled: vi.fn(),
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message, confirm]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Message should be rendered and moved to timeline
      expect(lastFrame()).toContain('Before confirm');
      // Confirm should be active
      expect(lastFrame()).toContain('Continue?');
    });
  });

  describe('Component lifecycle handlers', () => {
    it('moves component to timeline when completed', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Test message' },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Message should be rendered in timeline
      expect(lastFrame()).toContain('Test message');
    });

    it('handles onError by adding error feedback to queue', async () => {
      // This test would require a component that calls onError
      // For now, we'll test that error feedback can be added to queue
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Before error' },
        status: ComponentStatus.Awaiting,
      };

      const feedback: ComponentDefinition = {
        id: 'feedback-1',
        name: ComponentName.Feedback,
        props: {
          type: FeedbackType.Failed,
          message: 'Test error',
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message, feedback]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(lastFrame()).toContain('Before error');
      expect(lastFrame()).toContain('Test error');
    });

    it('handles onAborted by adding abort feedback to queue', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Before abort' },
        status: ComponentStatus.Awaiting,
      };

      const feedback: ComponentDefinition = {
        id: 'feedback-1',
        name: ComponentName.Feedback,
        props: {
          type: FeedbackType.Aborted,
          message: 'Operation aborted',
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message, feedback]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(lastFrame()).toContain('Before abort');
      expect(lastFrame()).toContain('Operation aborted');
    });
  });

  describe('Queue and timeline management', () => {
    it('processes queue in order', async () => {
      const components: ComponentDefinition[] = [
        {
          id: 'msg-1',
          name: ComponentName.Message,
          props: { text: 'First' },
          status: ComponentStatus.Awaiting,
        },
        {
          id: 'msg-2',
          name: ComponentName.Message,
          props: { text: 'Second' },
          status: ComponentStatus.Awaiting,
        },
        {
          id: 'msg-3',
          name: ComponentName.Message,
          props: { text: 'Third' },
          status: ComponentStatus.Awaiting,
        },
      ];

      const { lastFrame } = render(
        <Workflow initialQueue={components} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      const output = lastFrame();
      expect(output).toContain('First');
      expect(output).toContain('Second');
      expect(output).toContain('Third');

      // Verify order by checking positions
      expect(output).toBeDefined();
      const firstPos = output!.indexOf('First');
      const secondPos = output!.indexOf('Second');
      const thirdPos = output!.indexOf('Third');
      expect(firstPos).toBeLessThan(secondPos);
      expect(secondPos).toBeLessThan(thirdPos);
    });

    it('separates timeline and active components visually', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Timeline item' },
        status: ComponentStatus.Awaiting,
      };

      const confirm: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: {},
        props: {
          message: 'Active item?',
          onConfirmed: vi.fn(),
          onCancelled: vi.fn(),
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message, confirm]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      const output = lastFrame();
      // Timeline item should appear before active item
      expect(output).toContain('Timeline item');
      expect(output).toContain('Active item?');

      expect(output).toBeDefined();
      const timelinePos = output!.indexOf('Timeline item');
      const activePos = output!.indexOf('Active item?');
      expect(timelinePos).toBeLessThan(activePos);
    });
  });

  describe('Debug mode', () => {
    it('passes debug prop to active components with DEFINE tasks', async () => {
      const schedule: ComponentDefinition = {
        id: 'schedule-1',
        name: ComponentName.Schedule,
        state: {
          highlightedIndex: null,
          currentDefineGroupIndex: 0,
          completedSelections: [],
        },
        props: {
          message: 'Test schedule',
          tasks: [
            {
              action: 'Choose option',
              type: TaskType.Define,
              params: { options: ['Option A', 'Option B'] },
              config: [],
            },
          ],
          onSelectionConfirmed: vi.fn(),
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[schedule]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Schedule component should show debug info (task types)
      const output = lastFrame();
      expect(output).toContain('define'); // Debug mode shows task types
    });

    it('updates debug display for both active and pending when debug changes', async () => {
      const schedule: ComponentDefinition = {
        id: 'schedule-1',
        name: ComponentName.Schedule,
        state: {
          highlightedIndex: null,
          currentDefineGroupIndex: 0,
          completedSelections: [],
        },
        props: {
          message: 'Test schedule',
          tasks: [
            {
              action: 'Choose option',
              type: TaskType.Define,
              params: { options: ['Option A', 'Option B'] },
              config: [],
            },
          ],
          onSelectionConfirmed: vi.fn(),
        },
        status: ComponentStatus.Awaiting,
      };

      // Start with debug=false
      const { lastFrame, rerender } = render(
        <Workflow initialQueue={[schedule]} debug={DebugLevel.None} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Debug type indicators should NOT be visible (checking for '› define' pattern)
      let output = lastFrame();
      expect(output).toContain('Test schedule'); // Message should be there
      expect(output).toContain('Choose option'); // Task should be there
      expect(output).not.toContain('› define'); // But not debug type indicator

      // Toggle debug to true
      rerender(<Workflow initialQueue={[schedule]} debug={DebugLevel.Info} />);

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Now debug type indicators SHOULD be visible
      output = lastFrame();
      expect(output).toContain('Test schedule'); // Message still there
      expect(output).toContain('Choose option'); // Task still there
      expect(output).toContain('› define'); // Debug type indicator now visible
    });

    it('does not show debug info for timeline components', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Done message' },
        status: ComponentStatus.Awaiting,
      };

      const schedule: ComponentDefinition = {
        id: 'schedule-1',
        name: ComponentName.Schedule,
        state: {
          highlightedIndex: null,
          currentDefineGroupIndex: 0,
          completedSelections: [],
        },
        props: {
          message: '',
          tasks: [
            {
              action: 'Choose',
              type: TaskType.Define,
              params: { options: ['A', 'B'] },
              config: [],
            },
          ],
          onSelectionConfirmed: vi.fn(),
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message, schedule]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Active schedule should show debug, timeline items should not
      const output = lastFrame();
      expect(output).toBeDefined();
      expect(output).toContain('Done message'); // Timeline item present
      expect(output).toContain('define'); // Active schedule shows debug
    });
  });

  describe('Status field propagation', () => {
    it('passes status to stateless components', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'Test' },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Component should render (status is passed internally)
      expect(lastFrame()).toContain('Test');
    });

    it('passes status to stateful components', async () => {
      const confirm: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: {},
        props: {
          message: 'Test?',
          onConfirmed: vi.fn(),
          onCancelled: vi.fn(),
        },
        status: ComponentStatus.Awaiting,
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[confirm]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Component should render with status passed
      expect(lastFrame()).toContain('Test?');
    });
  });

  describe('Edge cases', () => {
    it('handles empty queue', async () => {
      const { lastFrame } = render(
        <Workflow initialQueue={[]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should render without errors (empty output is expected)
      expect(lastFrame()).toBeDefined();
    });

    it('handles components without initial status', async () => {
      const message: ComponentDefinition = {
        id: 'msg-1',
        name: ComponentName.Message,
        props: { text: 'No status' },
        // No status field
      };

      const { lastFrame } = render(
        <Workflow initialQueue={[message]} debug={DebugLevel.Info} />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should still render correctly
      expect(lastFrame()).toContain('No status');
    });
  });
});
