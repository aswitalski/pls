import { useEffect, useState } from 'react';
import { Box } from 'ink';

import {
  ComponentStatus,
  ScheduleProps,
  ScheduleState,
} from '../types/components.js';
import { ScheduledTask, Task, TaskType } from '../types/types.js';

import { getTaskColors, getTaskTypeLabel } from '../services/colors.js';
import { DebugLevel } from '../services/configuration.js';
import { useInput } from '../services/keyboard.js';

import { Label } from './Label.js';
import { List } from './List.js';

function taskToListItem(
  task: Task,
  highlightedChildIndex: number | null = null,
  isDefineTaskWithoutSelection: boolean = false,
  isCurrent: boolean = false,
  debug: DebugLevel = DebugLevel.None
) {
  const taskColors = getTaskColors(task.type, isCurrent);

  const item: {
    description: { text: string; color: string | undefined };
    type: { text: string; color: string | undefined };
    children: {
      description: { text: string; color: string | undefined };
      type: { text: string; color: string | undefined };
    }[];
    marker?: string;
    markerColor?: string;
  } = {
    description: {
      text: task.action,
      color: taskColors.description,
    },
    type: { text: getTaskTypeLabel(task.type, debug), color: taskColors.type },
    children: [],
  };

  // Mark define tasks with right arrow when no selection has been made
  if (isDefineTaskWithoutSelection) {
    item.marker = '  → ';
    item.markerColor = getTaskColors(TaskType.Schedule, isCurrent).type;
  }

  // Add children for Define tasks with options
  if (task.type === TaskType.Define && Array.isArray(task.params?.options)) {
    item.children = (task.params.options as string[]).map((option, index) => {
      // Determine the type based on selection state
      let childType = TaskType.Select;
      if (highlightedChildIndex !== null) {
        // A selection was made - mark others as discarded
        childType =
          index === highlightedChildIndex ? TaskType.Execute : TaskType.Discard;
      }

      const colors = getTaskColors(childType, isCurrent);
      const planColors = getTaskColors(TaskType.Schedule, isCurrent);
      return {
        description: {
          text: option,
          color: colors.description,
          highlightedColor: planColors.description,
        },
        type: {
          text: getTaskTypeLabel(childType, debug),
          color: colors.type,
          highlightedColor: planColors.type,
        },
      };
    });
  }

  // Add children for Group tasks with subtasks
  const scheduledTask = task as ScheduledTask;
  if (
    task.type === TaskType.Group &&
    scheduledTask.subtasks &&
    Array.isArray(scheduledTask.subtasks) &&
    scheduledTask.subtasks.length > 0
  ) {
    item.children = scheduledTask.subtasks.map((subtask) => {
      const subtaskColors = getTaskColors(subtask.type, isCurrent);
      return {
        description: {
          text: subtask.action,
          color: subtaskColors.description,
        },
        type: {
          text: getTaskTypeLabel(subtask.type, debug),
          color: subtaskColors.type,
        },
      };
    });
  }

  return item;
}

/**
 * Schedule view: Displays task list with navigation
 */

export interface ScheduleViewProps {
  message: string;
  tasks: Task[];
  state: ScheduleState;
  status: ComponentStatus;
  debug?: DebugLevel;
}

export const ScheduleView = ({
  message,
  tasks,
  state,
  status,
  debug = DebugLevel.None,
}: ScheduleViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { highlightedIndex, currentDefineGroupIndex, completedSelections } =
    state;

  // Find all Define tasks
  const defineTaskIndices = tasks
    .map((t, idx) => (t.type === TaskType.Define ? idx : -1))
    .filter((idx) => idx !== -1);

  // Get the current active define task
  const currentDefineTaskIndex =
    defineTaskIndices[currentDefineGroupIndex] ?? -1;

  const listItems = tasks.map((task, idx) => {
    // Find which define group this task belongs to (if any)
    const defineGroupIndex = defineTaskIndices.indexOf(idx);
    const isDefineTask = defineGroupIndex !== -1;

    // Determine child selection state
    let childIndex: number | null = null;
    if (isDefineTask) {
      if (defineGroupIndex < currentDefineGroupIndex) {
        // Previously completed group - show the selection
        childIndex = completedSelections[defineGroupIndex] ?? null;
      } else if (defineGroupIndex === currentDefineGroupIndex) {
        // Current active group - show live navigation unless not active
        if (!isActive) {
          // If not active, show the completed selection for this group too
          childIndex = completedSelections[defineGroupIndex] ?? null;
        } else {
          childIndex = null;
        }
      }
    }

    // Show arrow on current active define task when no child is highlighted and is active
    const isDefineWithoutSelection =
      isDefineTask &&
      defineGroupIndex === currentDefineGroupIndex &&
      highlightedIndex === null &&
      isActive;

    return taskToListItem(
      task,
      childIndex,
      isDefineWithoutSelection,
      isActive,
      debug
    );
  });

  return (
    <Box flexDirection="column">
      {message && (
        <Box marginBottom={1} marginLeft={1}>
          <Label
            description={message}
            taskType={TaskType.Schedule}
            showType={debug !== DebugLevel.None}
            isCurrent={isActive}
            debug={debug}
          />
        </Box>
      )}
      <Box marginLeft={1}>
        <List
          items={listItems}
          highlightedIndex={
            currentDefineTaskIndex >= 0 ? highlightedIndex : null
          }
          highlightedParentIndex={currentDefineTaskIndex}
          showType={debug !== DebugLevel.None}
        />
      </Box>
    </Box>
  );
};

/**
 * Schedule controller: Manages task selection and navigation
 */

export function Schedule({
  message,
  tasks,
  status,
  debug = DebugLevel.None,
  requestHandlers,
  lifecycleHandlers,
  onSelectionConfirmed,
}: ScheduleProps) {
  const isActive = status === ComponentStatus.Active;

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [currentDefineGroupIndex, setCurrentDefineGroupIndex] =
    useState<number>(0);
  const [completedSelections, setCompletedSelections] = useState<number[]>([]);

  // Find all Define tasks
  const defineTaskIndices = tasks
    .map((t, idx) => (t.type === TaskType.Define ? idx : -1))
    .filter((idx) => idx !== -1);

  // Get the current active define task
  const currentDefineTaskIndex =
    defineTaskIndices[currentDefineGroupIndex] ?? -1;
  const defineTask =
    currentDefineTaskIndex >= 0 ? tasks[currentDefineTaskIndex] : null;
  const optionsCount = Array.isArray(defineTask?.params?.options)
    ? (defineTask.params.options as string[]).length
    : 0;

  const hasMoreGroups = currentDefineGroupIndex < defineTaskIndices.length - 1;

  // If no DEFINE tasks, immediately confirm with all tasks
  useEffect(() => {
    if (isActive && defineTaskIndices.length === 0 && onSelectionConfirmed) {
      // No selection needed - all tasks are concrete
      const concreteTasks = tasks.filter(
        (task) =>
          task.type !== TaskType.Ignore && task.type !== TaskType.Discard
      );

      // Expose final state
      const finalState: ScheduleState = {
        highlightedIndex,
        currentDefineGroupIndex,
        completedSelections,
      };
      requestHandlers.onCompleted(finalState);

      // Complete the selection phase - it goes to timeline
      // Callback will create a new Plan showing refined tasks (pending) + Confirm (active)
      lifecycleHandlers.completeActive();
      void onSelectionConfirmed(concreteTasks);
    }
  }, [
    isActive,
    defineTaskIndices.length,
    tasks,
    onSelectionConfirmed,
    lifecycleHandlers,
    highlightedIndex,
    currentDefineGroupIndex,
    completedSelections,
    requestHandlers,
  ]);

  useInput(
    (input, key) => {
      // Don't handle input if not active or no define task
      if (!isActive || !defineTask) {
        return;
      }

      if (key.escape) {
        requestHandlers.onAborted('task selection');
        return;
      }

      if (key.downArrow) {
        setHighlightedIndex((prev) => {
          if (prev === null) {
            return 0; // Select first
          }
          return (prev + 1) % optionsCount; // Wrap around
        });
      } else if (key.upArrow) {
        setHighlightedIndex((prev) => {
          if (prev === null) {
            return optionsCount - 1; // Select last
          }
          return (prev - 1 + optionsCount) % optionsCount; // Wrap around
        });
      } else if (key.return && highlightedIndex !== null) {
        // Record the selection for this group
        const newCompletedSelections = [...completedSelections];
        newCompletedSelections[currentDefineGroupIndex] = highlightedIndex;
        setCompletedSelections(newCompletedSelections);

        if (hasMoreGroups) {
          // Advance to next group
          const newGroupIndex = currentDefineGroupIndex + 1;
          setCurrentDefineGroupIndex(newGroupIndex);
          setHighlightedIndex(null);
        } else {
          // Clear highlight to show Execute color
          setHighlightedIndex(null);

          // Build refined task list with only selected options (no discarded or ignored ones)
          const refinedTasks: Task[] = [];

          tasks.forEach((task, idx) => {
            const defineGroupIndex = defineTaskIndices.indexOf(idx);

            if (
              defineGroupIndex !== -1 &&
              Array.isArray(task.params?.options)
            ) {
              // This is a Define task - only include the selected option
              const options = task.params.options as string[];
              const selectedIndex = newCompletedSelections[defineGroupIndex];
              const selectedOption = options[selectedIndex];

              // Use Execute as default - LLM will properly classify during refinement
              refinedTasks.push({
                action: selectedOption,
                type: TaskType.Execute,
                config: [],
              });
            } else if (
              task.type !== TaskType.Ignore &&
              task.type !== TaskType.Discard
            ) {
              // Regular task - keep as is, but skip Ignore and Discard tasks
              refinedTasks.push(task);
            }
          });

          // Expose final state
          const finalState: ScheduleState = {
            highlightedIndex: null,
            currentDefineGroupIndex,
            completedSelections: newCompletedSelections,
          };
          requestHandlers.onCompleted(finalState);

          if (onSelectionConfirmed) {
            // Complete the selection phase - it goes to timeline
            // Callback will create a new Plan showing refined tasks (pending) + Confirm (active)
            lifecycleHandlers.completeActive();
            void onSelectionConfirmed(refinedTasks);
          } else {
            // No selection callback, just complete normally
            lifecycleHandlers.completeActive();
          }
        }
      }
    },
    { isActive: isActive && defineTask !== null }
  );

  // Controller always renders View, passing current state
  const state: ScheduleState = {
    highlightedIndex,
    currentDefineGroupIndex,
    completedSelections,
  };

  return (
    <ScheduleView
      message={message}
      tasks={tasks}
      state={state}
      status={status}
      debug={debug}
    />
  );
}
