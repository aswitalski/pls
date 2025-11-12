import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { PlanState } from '../src/types/components.js';
import { TaskType } from '../src/types/types.js';

import { Plan } from '../src/ui/Plan.js';

// Keyboard input constants
const ArrowDown = '\x1B[B';
const ArrowUp = '\x1B[A';
const Enter = '\r';
const Escape = '\x1B';
const WaitTime = 40;

// Mock onAborted function for all tests
const mockOnAborted = vi.fn();

describe('Plan component', () => {
  describe('Interactive behavior', () => {
    it('renders define task without initial highlight', () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const { lastFrame } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
        />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
      expect(state.highlightedIndex).toBeNull();
    });

    it('marks define task with right arrow when no selection made', () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const { lastFrame } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
        />
      );

      const output = lastFrame();
      // The define task should have a right arrow marker
      expect(output).toContain('→');
      expect(output).toContain('Choose deployment');
    });

    it('removes arrow from parent when child is highlighted', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const { lastFrame, stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
        />
      );

      // Initially, parent has arrow
      let output = lastFrame();
      const arrowCountBefore = (output!.match(/→/g) || []).length;

      // Press down arrow to highlight first child
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // After highlighting, there should still be arrows (on the child)
      // but the parent's marker should be a dash
      output = lastFrame();
      expect(output).toContain('Choose deployment');
      expect(state.highlightedIndex).toBe(0);

      // The child should now have the arrow
      const arrowCountAfter = (output!.match(/→/g) || []).length;
      expect(arrowCountAfter).toBeGreaterThan(0);
    });

    it('calls onSelectionConfirmed when selection is made', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Press down arrow to highlight first option
      stdin.write(ArrowDown);

      // Wait for React to process
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Press enter to confirm
      stdin.write(Enter);

      // Wait for React to process
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith(
        0,
        expect.arrayContaining([
          expect.objectContaining({
            action: 'Choose deployment',
            type: TaskType.Execute,
          }),
        ])
      );
    });

    it('does nothing when Enter pressed without highlighting', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Press Enter without navigating first
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should not have called callback
      expect(onSelectionConfirmed).not.toHaveBeenCalled();
      // State should remain unchanged
      expect(state.highlightedIndex).toBeNull();
      expect(state.completedSelections).toHaveLength(0);
    });

    it('supports navigation with arrow keys', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging', 'Development'] },
            },
          ]}
        />
      );

      // Press down arrow to select first item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);

      // Press down arrow again to select second item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(1);

      // Press up arrow to go back to first item
      stdin.write(ArrowUp);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);
    });

    it('wraps around when navigating with arrow keys', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
        />
      );

      // Press up arrow from null position to select last item
      stdin.write(ArrowUp);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(1);

      // Press down arrow to wrap to first item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);

      // Press down arrow again to wrap to second item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(1);
    });

    it('does not handle input when done', () => {
      const state: PlanState = {
        done: true,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      stdin.write(ArrowDown);
      stdin.write(Enter);

      expect(state.highlightedIndex).toBeNull();
      expect(onSelectionConfirmed).not.toHaveBeenCalled();
    });

    it('does not handle input when no define tasks exist', () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            { action: 'Install dependencies', type: TaskType.Execute },
            { action: 'Run tests', type: TaskType.Execute },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Try to interact - should do nothing
      stdin.write(ArrowDown);
      stdin.write(Enter);

      expect(state.highlightedIndex).toBeNull();
      expect(onSelectionConfirmed).not.toHaveBeenCalled();
    });

    it('renders selection with correct visual states', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { lastFrame, stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging', 'Development'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Navigate to second item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Confirm selection
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      const output = lastFrame();
      expect(output).toBeTruthy();

      // Verify selected item shows as "execute"
      expect(output).toContain('Staging');
      expect(output).toContain(TaskType.Execute);

      // Verify non-selected items show as "discard"
      expect(output).toContain(TaskType.Discard);

      expect(onSelectionConfirmed).toHaveBeenCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({
            type: TaskType.Execute,
          }),
        ])
      );
    });
  });

  describe('Multiple define groups', () => {
    it('initializes state with correct values for multiple groups', () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const { lastFrame } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            { action: 'Build project', type: TaskType.Execute },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
        />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();
      expect(state.currentDefineGroupIndex).toBe(0);
      expect(state.completedSelections).toEqual([]);
    });

    it('shows arrow on first define group initially', () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const { lastFrame } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
        />
      );

      const output = lastFrame();
      expect(output).toContain('→');
      expect(output).toContain('Choose target');
    });

    it('advances to next group when Enter is pressed', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Select first option in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);

      // Press Enter to confirm
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should advance to next group
      expect(state.currentDefineGroupIndex).toBe(1);
      expect(state.completedSelections).toEqual([0]);
      expect(state.highlightedIndex).toBeNull();

      // Should not have called onSelectionConfirmed yet
      expect(onSelectionConfirmed).not.toHaveBeenCalled();
    });

    it('keeps previous group selection visible when advancing', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { lastFrame, stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
        />
      );

      // Select first option in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Now on second group - first group's selection should still be visible
      const output = lastFrame();
      expect(output).toContain('Alpha');
      expect(output).toContain('Choose target');
      expect(output).toContain('Choose environment');

      // First group should show its completed selection
      expect(state.completedSelections).toEqual([0]);
      expect(state.currentDefineGroupIndex).toBe(1);
    });

    it('resets highlightedIndex when advancing to next group', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
        />
      );

      // Highlight and select in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // highlightedIndex should be reset to null
      expect(state.highlightedIndex).toBeNull();
    });

    it('shows arrow on second group after first is completed', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { lastFrame, stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
        />
      );

      // Complete first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      const output = lastFrame();
      expect(output).toContain('→');
      expect(output).toContain('Choose environment');
    });

    it('calls onSelectionConfirmed only after last group is completed', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Complete first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).not.toHaveBeenCalled();

      // Complete second group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith(
        0,
        expect.arrayContaining([
          expect.objectContaining({
            action: 'Choose target',
            type: TaskType.Execute,
          }),
          expect.objectContaining({
            action: 'Choose environment',
            type: TaskType.Execute,
          }),
        ])
      );
    });

    it('tracks completedSelections for all groups', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta', 'Gamma'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
          ]}
        />
      );

      // Select second option in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(state.completedSelections).toEqual([1]);

      // Select first option in second group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(state.completedSelections).toEqual([1, 0]);
    });

    it('handles three sequential define groups', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
            {
              action: 'Choose region',
              type: TaskType.Define,
              params: { options: ['US', 'EU', 'Asia'] },
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Complete first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.currentDefineGroupIndex).toBe(1);
      expect(onSelectionConfirmed).not.toHaveBeenCalled();

      // Complete second group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.currentDefineGroupIndex).toBe(2);
      expect(onSelectionConfirmed).not.toHaveBeenCalled();

      // Complete third group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledTimes(1);
      expect(state.completedSelections).toEqual([0, 0, 0]);
    });

    it('handles mixed execute and define tasks', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            { action: 'Build project', type: TaskType.Execute },
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            { action: 'Run tests', type: TaskType.Execute },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production'] },
            },
            { action: 'Deploy', type: TaskType.Execute },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // Complete first define group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.currentDefineGroupIndex).toBe(1);

      // Complete second define group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith(
        0,
        expect.arrayContaining([
          expect.objectContaining({
            action: 'Build project',
            type: TaskType.Execute,
          }),
          expect.objectContaining({
            action: 'Choose target',
            type: TaskType.Execute,
          }),
          expect.objectContaining({
            action: 'Run tests',
            type: TaskType.Execute,
          }),
          expect.objectContaining({
            action: 'Choose environment',
            type: TaskType.Execute,
          }),
          expect.objectContaining({
            action: 'Deploy',
            type: TaskType.Execute,
          }),
        ])
      );
    });

    it('navigation only works on current active group', async () => {
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={mockOnAborted}
          state={state}
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: ['Alpha', 'Beta'] },
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: { options: ['Development', 'Production', 'Staging'] },
            },
          ]}
        />
      );

      // First group has 2 options
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);

      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(1);

      // Wraps back to 0 (only 2 options)
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);

      // Complete first group
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Now in second group with 3 options
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);

      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(1);

      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(2);

      // Wraps back to 0 (3 options)
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      expect(state.highlightedIndex).toBe(0);
    });
  });

  describe('Abort handling', () => {
    it('calls onAborted when Esc is pressed during selection', () => {
      const onAborted = vi.fn();
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={onAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
        />
      );

      stdin.write(Escape);
      expect(onAborted).toHaveBeenCalledTimes(1);
    });

    it('does not call onAborted when Esc is pressed after done', () => {
      const onAborted = vi.fn();
      const state: PlanState = {
        done: true,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={onAborted}
          state={state}
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
          ]}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });

    it('does not call onAborted when there is no define task', () => {
      const onAborted = vi.fn();
      const state: PlanState = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const { stdin } = render(
        <Plan
          onAborted={onAborted}
          state={state}
          tasks={[
            {
              action: 'Deploy application',
              type: TaskType.Execute,
            },
          ]}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });
  });
});
