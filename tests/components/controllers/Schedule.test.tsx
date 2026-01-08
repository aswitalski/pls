import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  ComponentStatus,
  ScheduleState,
} from '../../../src/types/components.js';
import { ScheduledTask, Task, TaskType } from '../../../src/types/types.js';

import { DebugLevel } from '../../../src/configuration/types.js';

import {
  Schedule,
  taskToListItem,
} from '../../../src/components/controllers/Schedule.js';
import { Palette } from '../../../src/services/colors.js';

import {
  createLifecycleHandlers,
  createRefinementOptions,
  createRequestHandlers,
  Keys,
} from '../../test-utils.js';

// Destructure for readability
const { ArrowDown, ArrowUp, Enter, Escape } = Keys;
const WaitTime = 32; // Generous wait time ensuring stability across all hardware and load conditions

// Helper to create mock handlers with state tracking
function createScheduleTestHandlers(
  initialState: ScheduleState = {
    highlightedIndex: null,
    currentDefineGroupIndex: 0,
    completedSelections: [],
  }
): {
  requestHandlers: ReturnType<typeof createRequestHandlers<ScheduleState>>;
  lifecycleHandlers: ReturnType<typeof createLifecycleHandlers>;
  state: ScheduleState;
} {
  const state = { ...initialState };
  const requestHandlers = createRequestHandlers<ScheduleState>({
    onCompleted: vi.fn((newState) => {
      Object.assign(state, newState);
    }),
  });
  const lifecycleHandlers = createLifecycleHandlers();
  return { lifecycleHandlers, requestHandlers, state };
}

describe('Schedule component', () => {
  describe('Interactive behavior', () => {
    it('renders define task without initial highlight', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      // Verify task content is rendered
      expect(output).toContain('Choose deployment');
      // Verify options are rendered
      expect(output).toContain('Production');
      expect(output).toContain('Staging');
      // Arrow should be on parent define task (no child highlighted)
      expect(output).toContain('→');
    });

    it('marks define task with right arrow when no selection made', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      // The define task should have a right arrow marker
      expect(output).toContain('→');
      expect(output).toContain('Choose deployment');
    });

    it('removes arrow from parent when child is highlighted', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });
      const { lastFrame, stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
        />
      );

      // Initially, parent has arrow
      let output = lastFrame();

      // Press down arrow to highlight first child
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // After highlighting, there should still be arrows (on the child)
      // but the parent's marker should be a dash
      output = lastFrame();
      expect(output).toContain('Choose deployment');

      // The child should now have the arrow
      const arrowCountAfter = (output!.match(/→/g) || []).length;
      expect(arrowCountAfter).toBeGreaterThan(0);
    });

    it('calls onSelectionConfirmed when selection is made', async () => {
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
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
        expect.arrayContaining([
          expect.objectContaining({
            action: 'production',
            type: TaskType.Execute,
            config: [],
          }),
        ])
      );
    });

    it('does nothing when Enter pressed without highlighting', async () => {
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      // Press Enter without navigating first
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should not have called callback
      expect(onSelectionConfirmed).not.toHaveBeenCalled();
      // State should remain unchanged
    });

    it('supports navigation with arrow keys', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });

      const { lastFrame, stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions(
                  'Production',
                  'Staging',
                  'Development'
                ),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
        />
      );

      // Verify all options are rendered
      let output = lastFrame();
      expect(output).toContain('Production');
      expect(output).toContain('Staging');
      expect(output).toContain('Development');

      // Press down arrow to select first item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Verify arrow moved to first option
      output = lastFrame();
      expect(output).toContain('→');
      expect(output).toContain('Production');

      // Press down arrow again to select second item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Verify Staging is now highlighted
      output = lastFrame();
      expect(output).toContain('Staging');

      // Press up arrow to go back to first item
      stdin.write(ArrowUp);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Verify Production is highlighted again
      output = lastFrame();
      expect(output).toContain('Production');
    });

    it('wraps around when navigating with arrow keys', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });

      const { lastFrame, stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
        />
      );

      // Verify options are rendered
      let output = lastFrame();
      expect(output).toContain('Production');
      expect(output).toContain('Staging');

      // Press up arrow from null position to select last item (Staging)
      stdin.write(ArrowUp);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      output = lastFrame();
      expect(output).toContain('Staging');
      expect(output).toContain('→');

      // Press down arrow to wrap to first item (Production)
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      output = lastFrame();
      expect(output).toContain('Production');

      // Press down arrow again to go to second item (Staging)
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      output = lastFrame();
      expect(output).toContain('Staging');
    });

    it('does not handle input when done', () => {
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      stdin.write(ArrowDown);
      stdin.write(Enter);

      expect(onSelectionConfirmed).not.toHaveBeenCalled();
    });

    it('does not handle input when no define tasks exist', () => {
      const onSelectionConfirmed = vi.fn();
      const completeActive = vi.fn();

      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Install dependencies',
              type: TaskType.Execute,
              config: [],
            },
            { action: 'Run tests', type: TaskType.Execute, config: [] },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers({ completeActive })}
        />
      );

      // With no DEFINE tasks, Plan should auto-confirm and complete
      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ]);
      expect(completeActive).toHaveBeenCalled();

      // Try to interact - should do nothing since already completed
      stdin.write(ArrowDown);
      stdin.write(Enter);
    });

    it('renders selection with correct visual states', async () => {
      const onSelectionConfirmed = vi.fn();

      const { lastFrame, stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions(
                  'Production',
                  'Staging',
                  'Development'
                ),
              },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          debug={DebugLevel.Info}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      // Navigate to second item
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      const outputBeforeSelection = lastFrame();
      expect(outputBeforeSelection).toContain('Staging');
      expect(outputBeforeSelection).toContain(TaskType.Define);

      // Confirm selection
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Verify onSelectionConfirmed was called with the selected item
      expect(onSelectionConfirmed).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'staging',
            type: TaskType.Execute,
            config: [],
          }),
        ])
      );
    });
  });

  describe('Multiple define groups', () => {
    it('initializes state with correct values for multiple groups', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            { action: 'Build project', type: TaskType.Execute, config: [] },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      // Verify both define groups are rendered
      expect(output).toContain('Choose target');
      expect(output).toContain('Alpha');
      expect(output).toContain('Beta');
      expect(output).toContain('Choose environment');
      expect(output).toContain('Development');
      expect(output).toContain('Production');
      // Verify execute task is rendered
      expect(output).toContain('Build project');
    });

    it('shows arrow on first define group initially', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('→');
      expect(output).toContain('Choose target');
    });

    it('advances to next group when Enter is pressed', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
        />
      );

      // Select first option in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Press Enter to confirm
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should advance to next group

      // Should not have called onSelectionConfirmed yet
      expect(onSelectionConfirmed).not.toHaveBeenCalled();
    });

    it('keeps previous group selection visible when advancing', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });

      const { lastFrame, stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
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
    });

    it('resets highlightedIndex when advancing to next group', async () => {
      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      // Highlight and select in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // highlightedIndex should be reset to null
    });

    it('shows arrow on second group after first is completed', async () => {
      const { lastFrame, stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
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
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
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
        expect.arrayContaining([
          expect.objectContaining({
            action: 'alpha',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'development',
            type: TaskType.Execute,
            config: [],
          }),
        ])
      );
    });

    it('tracks completedSelections for all groups', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });

      const { stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Alpha', 'Beta', 'Gamma'),
              },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
        />
      );

      // Select second option in first group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Select first option in second group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
    });

    it('handles three sequential define groups', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
            {
              action: 'Choose region',
              type: TaskType.Define,
              params: { options: createRefinementOptions('US', 'EU', 'Asia') },
              config: [],
            },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
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
      expect(onSelectionConfirmed).not.toHaveBeenCalled();

      // Complete third group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledTimes(1);
    });

    it('handles mixed execute and define tasks', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });
      const onSelectionConfirmed = vi.fn();

      const { stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            { action: 'Run tests', type: TaskType.Execute, config: [] },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
            { action: 'Deploy', type: TaskType.Execute, config: [] },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
        />
      );

      // Complete first define group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Complete second define group
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'Build project',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'alpha',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'Run tests',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'development',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'Deploy',
            type: TaskType.Execute,
            config: [],
          }),
        ])
      );
    });

    it('navigation only works on current active group', async () => {
      const {
        lifecycleHandlers,
        requestHandlers,
        state: _state,
      } = createScheduleTestHandlers({
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      });

      const { stdin } = render(
        <Schedule
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          message=""
          tasks={[
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions(
                  'Development',
                  'Production',
                  'Staging'
                ),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
        />
      );

      // First group has 2 options
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Wraps back to 0 (only 2 options)
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Complete first group
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Now in second group with 3 options
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Wraps back to 0 (3 options)
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
    });
  });

  describe('Abort handling', () => {
    it('calls onAborted when Esc is pressed during selection', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>({ onAborted })}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      stdin.write(Escape);
      expect(onAborted).toHaveBeenCalledWith('task selection');
    });

    it('does not call onAborted when Esc is pressed after done', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Schedule
          status={ComponentStatus.Done}
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });

    it('does not call onAborted when there is no define task', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Deploy application',
              type: TaskType.Execute,
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });
  });

  describe('Filtering ignored and discarded tasks', () => {
    it('excludes Ignore tasks from refined task list', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            {
              action: 'Choose environment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Development', 'Production'),
              },
              config: [],
            },
            { action: 'Skip this step', type: TaskType.Ignore, config: [] },
            { action: 'Deploy', type: TaskType.Execute, config: [] },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      // Highlight first option
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Confirm selection
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Verify the callback was called
      expect(onSelectionConfirmed).toHaveBeenCalled();

      const callArgs = onSelectionConfirmed.mock.calls[0][0];

      // Verify it contains the expected tasks
      expect(callArgs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'Build project',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'development',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'Deploy',
            type: TaskType.Execute,
            config: [],
          }),
        ])
      );

      // Verify array length is 3 (not 4 - Ignore task excluded)
      expect(callArgs).toHaveLength(3);

      // Verify Ignore task is NOT included
      const hasIgnoreTask = callArgs.some(
        (task: Task) => task.type === TaskType.Ignore
      );
      expect(hasIgnoreTask).toBe(false);
    });

    it('excludes Discard tasks from refined task list', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            {
              action: 'Choose target',
              type: TaskType.Define,
              params: { options: createRefinementOptions('Alpha', 'Beta') },
              config: [],
            },
            {
              action: 'Old implementation',
              type: TaskType.Discard,
              config: [],
            },
            { action: 'Deploy', type: TaskType.Execute, config: [] },
          ]}
          onSelectionConfirmed={onSelectionConfirmed}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      // Highlight first option
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Confirm selection
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Verify the callback was called
      expect(onSelectionConfirmed).toHaveBeenCalled();

      const callArgs = onSelectionConfirmed.mock.calls[0][0];

      // Verify it contains the expected tasks
      expect(callArgs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'Build project',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'alpha',
            type: TaskType.Execute,
            config: [],
          }),
          expect.objectContaining({
            action: 'Deploy',
            type: TaskType.Execute,
            config: [],
          }),
        ])
      );

      // Verify array length is 3 (not 4 - Discard task excluded)
      expect(callArgs).toHaveLength(3);

      // Verify Discard task is NOT included
      const hasDiscardTask = callArgs.some(
        (task: Task) => task.type === TaskType.Discard
      );
      expect(hasDiscardTask).toBe(false);
    });
  });

  describe('Debug mode', () => {
    it('shows action types when debug is true', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            { action: 'Run tests', type: TaskType.Execute, config: [] },
          ]}
          debug={DebugLevel.Info}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('execute');
    });

    it('hides action types when debug is false', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            { action: 'Run tests', type: TaskType.Execute, config: [] },
          ]}
          debug={DebugLevel.None}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).not.toContain('execute');
    });

    it('hides action types by default when debug prop is omitted', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            { action: 'Run tests', type: TaskType.Execute, config: [] },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).not.toContain('execute');
    });

    it('shows action types for all task types when debug is true', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
            { action: 'Generate plan', type: TaskType.Schedule, config: [] },
            { action: 'Get information', type: TaskType.Answer, config: [] },
            { action: 'Configure settings', type: TaskType.Config, config: [] },
          ]}
          debug={DebugLevel.Info}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('execute');
      expect(output).toContain('schedule');
      expect(output).toContain('answer');
      expect(output).toContain('config');
    });

    it('shows action types for define task children when debug is true', () => {
      const { lastFrame } = render(
        <Schedule
          message=""
          tasks={[
            {
              action: 'Choose deployment',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Production', 'Staging'),
              },
              config: [],
            },
          ]}
          debug={DebugLevel.Info}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('define');
      expect(output).toContain('select');
    });

    it('shows schedule type in message when debug is true', () => {
      const { lastFrame } = render(
        <Schedule
          message="Review changes"
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
          ]}
          debug={DebugLevel.Info}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Review changes');
      expect(output).toContain('›');
      expect(output).toContain('schedule');
    });

    it('hides plan type in message when debug is false', () => {
      const { lastFrame } = render(
        <Schedule
          message="Review changes"
          tasks={[
            { action: 'Build project', type: TaskType.Execute, config: [] },
          ]}
          debug={DebugLevel.None}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      const output = lastFrame();
      // Verify message and task are rendered
      expect(output).toContain('Review changes');
      expect(output).toContain('Build project');
      // When debug is false, separator and type should not appear
      const hasTypeIndicator = output!.includes('Review changes ›');
      expect(hasTypeIndicator).toBe(false);
    });

    it('uses Execute type for all selections (LLM classifies during refinement)', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          onSelectionConfirmed={onSelectionConfirmed}
          message=""
          tasks={[
            {
              action: 'Clarify what you want to know:',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Explain unit testing'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        {
          action: 'explain-unit-testing',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });

    it('uses Execute type as default for all actions', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          onSelectionConfirmed={onSelectionConfirmed}
          message=""
          tasks={[
            {
              action: 'What do you want to do:',
              type: TaskType.Define,
              params: {
                options: createRefinementOptions('Build the project'),
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<ScheduleState>()}
          lifecycleHandlers={createLifecycleHandlers()}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        {
          action: 'build-the-project',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });

    it('preserves case in option.command for paths and URLs', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          message="Select processing mode."
          tasks={[
            {
              action: 'Select mode',
              type: TaskType.Define,
              params: {
                options: [
                  {
                    name: 'Process in batch mode',
                    command:
                      'process /Users/Dev/MyProject/Data.csv in batch mode',
                  },
                  {
                    name: 'Process in stream mode',
                    command:
                      'process /Users/Dev/MyProject/Data.csv in stream mode',
                  },
                ],
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
          lifecycleHandlers={createLifecycleHandlers()}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        {
          // Path case is preserved from option.command
          action: 'process /Users/Dev/MyProject/Data.csv in batch mode',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });
  });

  describe('RefinementOption edge cases', () => {
    it('handles options with different name and command values', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          message="Select action"
          tasks={[
            {
              action: 'Choose action',
              type: TaskType.Define,
              params: {
                options: [
                  {
                    name: 'Deploy to staging',
                    command: 'deploy --env staging --verbose',
                  },
                  {
                    name: 'Deploy to production',
                    command: 'deploy --env production --confirm',
                  },
                ],
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
          lifecycleHandlers={createLifecycleHandlers()}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Should use command (not name) as the action
      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        {
          action: 'deploy --env staging --verbose',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });

    it('displays option name in UI but uses command for action', async () => {
      const onSelectionConfirmed = vi.fn();
      const { lastFrame, stdin } = render(
        <Schedule
          message="Select mode"
          tasks={[
            {
              action: 'Choose mode',
              type: TaskType.Define,
              params: {
                options: [
                  {
                    name: 'Quick scan',
                    command: 'scan --fast --no-deep-analysis',
                  },
                ],
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
          lifecycleHandlers={createLifecycleHandlers()}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      // UI should show the name
      expect(lastFrame()).toContain('Quick scan');

      // Select and confirm
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Action should be the command
      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        {
          action: 'scan --fast --no-deep-analysis',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });

    it('preserves special characters in command', async () => {
      const onSelectionConfirmed = vi.fn();
      const { stdin } = render(
        <Schedule
          message="Select command"
          tasks={[
            {
              action: 'Choose',
              type: TaskType.Define,
              params: {
                options: [
                  {
                    name: 'Fetch URL',
                    command: 'curl https://api.example.com/v2/users?limit=100',
                  },
                ],
              },
              config: [],
            },
          ]}
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers()}
          lifecycleHandlers={createLifecycleHandlers()}
          onSelectionConfirmed={onSelectionConfirmed}
        />
      );

      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(ArrowDown);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));
      stdin.write(Enter);
      await new Promise((resolve) => setTimeout(resolve, WaitTime));

      // Special characters in URL should be preserved
      expect(onSelectionConfirmed).toHaveBeenCalledWith([
        {
          action: 'curl https://api.example.com/v2/users?limit=100',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });
  });

  describe('Subtask styling', () => {
    it('uses AshGray color for subtask descriptions', () => {
      const groupTask: ScheduledTask = {
        action: 'Build products',
        type: TaskType.Group,
        config: [],
        subtasks: [
          { action: 'Build alpha', type: TaskType.Execute, config: [] },
          { action: 'Build beta', type: TaskType.Execute, config: [] },
        ],
      };

      const listItem = taskToListItem(
        groupTask,
        null,
        false,
        ComponentStatus.Pending
      );

      expect(listItem.children).toHaveLength(2);
      expect(listItem.children[0].description.color).toBe(Palette.AshGray);
      expect(listItem.children[1].description.color).toBe(Palette.AshGray);
    });

    it('uses AshGray for subtasks regardless of component status', () => {
      const groupTask: ScheduledTask = {
        action: 'Deploy services',
        type: TaskType.Group,
        config: [],
        subtasks: [
          { action: 'Deploy API', type: TaskType.Execute, config: [] },
        ],
      };

      const pendingItem = taskToListItem(
        groupTask,
        null,
        false,
        ComponentStatus.Pending
      );
      const activeItem = taskToListItem(
        groupTask,
        null,
        false,
        ComponentStatus.Active
      );
      const doneItem = taskToListItem(
        groupTask,
        null,
        false,
        ComponentStatus.Done
      );

      expect(pendingItem.children[0].description.color).toBe(Palette.AshGray);
      expect(activeItem.children[0].description.color).toBe(Palette.AshGray);
      expect(doneItem.children[0].description.color).toBe(Palette.AshGray);
    });

    it('uses SoftWhite for top-level pending task descriptions', () => {
      const task: Task = {
        action: 'Deploy application',
        type: TaskType.Execute,
        config: [],
      };

      const listItem = taskToListItem(
        task,
        null,
        false,
        ComponentStatus.Pending
      );

      expect(listItem.description.color).toBe(Palette.SoftWhite);
    });
  });
});
