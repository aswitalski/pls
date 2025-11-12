import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { PlanProps } from '../types/components.js';
import { Task, TaskType } from '../types/types.js';

import { Label } from './Label.js';
import { List } from './List.js';

const ColorPalette: Record<
  TaskType,
  {
    description: string;
    type: string;
  }
> = {
  [TaskType.Config]: {
    description: '#ffffff', // white
    type: '#5c9ccc', // cyan
  },
  [TaskType.Plan]: {
    description: '#ffffff', // white
    type: '#5ccccc', // magenta
  },
  [TaskType.Execute]: {
    description: '#ffffff', // white
    type: '#4a9a7a', // green
  },
  [TaskType.Answer]: {
    description: '#ffffff', // white
    type: '#9c5ccc', // purple
  },
  [TaskType.Report]: {
    description: '#ffffff', // white
    type: '#cc9c5c', // orange
  },
  [TaskType.Define]: {
    description: '#ffffff', // white
    type: '#cc9c5c', // amber
  },
  [TaskType.Ignore]: {
    description: '#cccc5c', // yellow
    type: '#cc7a5c', // orange
  },
  [TaskType.Select]: {
    description: '#888888', // grey
    type: '#5c8cbc', // steel blue
  },
  [TaskType.Discard]: {
    description: '#666666', // dark grey
    type: '#a85c3f', // dark orange
  },
};

function taskToListItem(
  task: Task,
  highlightedChildIndex: number | null = null,
  isDefineTaskWithoutSelection: boolean = false
) {
  const item: {
    description: { text: string; color: string };
    type: { text: string; color: string };
    children: {
      description: { text: string; color: string };
      type: { text: string; color: string };
    }[];
    marker?: string;
  } = {
    description: {
      text: task.action,
      color: ColorPalette[task.type].description,
    },
    type: { text: task.type, color: ColorPalette[task.type].type },
    children: [],
  };

  // Mark define tasks with right arrow when no selection has been made
  if (isDefineTaskWithoutSelection) {
    item.marker = '  → ';
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

      const colors = ColorPalette[childType];
      return {
        description: {
          text: String(option),
          color: colors.description,
          highlightedColor: ColorPalette[TaskType.Plan].description,
        },
        type: {
          text: childType,
          color: colors.type,
          highlightedColor: ColorPalette[TaskType.Plan].type,
        },
      };
    });
  }

  return item;
}

export function Plan({
  message,
  tasks,
  state,
  onSelectionConfirmed,
  onAborted,
}: PlanProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(
    state?.highlightedIndex ?? null
  );
  const [currentDefineGroupIndex, setCurrentDefineGroupIndex] =
    useState<number>(state?.currentDefineGroupIndex ?? 0);
  const [completedSelections, setCompletedSelections] = useState<number[]>(
    state?.completedSelections ?? []
  );
  const [isDone, setIsDone] = useState<boolean>(state?.done ?? false);

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

  useInput(
    (input, key) => {
      // Don't handle input if already done or no define task
      if (isDone || !defineTask) {
        return;
      }

      if (key.escape) {
        onAborted();
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
          setCurrentDefineGroupIndex(currentDefineGroupIndex + 1);
          setHighlightedIndex(null);
        } else {
          // Last group - mark as done to show the selection
          setIsDone(true);
          setHighlightedIndex(null); // Clear highlight to show Execute color
          if (state) {
            state.done = true;
          }

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

              refinedTasks.push({
                action: String(options[selectedIndex]),
                type: TaskType.Execute,
              });
            } else if (
              task.type !== TaskType.Ignore &&
              task.type !== TaskType.Discard
            ) {
              // Regular task - keep as is, but skip Ignore and Discard tasks
              refinedTasks.push(task);
            }
          });

          onSelectionConfirmed?.(refinedTasks);
        }
      }
    },
    { isActive: !isDone && defineTask !== null }
  );

  // Sync state back to state object
  useEffect(() => {
    if (state) {
      state.highlightedIndex = highlightedIndex;
      state.currentDefineGroupIndex = currentDefineGroupIndex;
      state.completedSelections = completedSelections;
      state.done = isDone;
    }
  }, [
    highlightedIndex,
    currentDefineGroupIndex,
    completedSelections,
    isDone,
    state,
  ]);

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
        // Current active group - show live navigation unless done
        if (isDone) {
          // If done, show the completed selection for this group too
          childIndex = completedSelections[defineGroupIndex] ?? null;
        } else {
          childIndex = null;
        }
      }
    }

    // Show arrow on current active define task when no child is highlighted and not done
    const isDefineWithoutSelection =
      isDefineTask &&
      defineGroupIndex === currentDefineGroupIndex &&
      highlightedIndex === null &&
      !isDone;

    return taskToListItem(task, childIndex, isDefineWithoutSelection);
  });

  return (
    <Box flexDirection="column">
      {message && (
        <Box marginBottom={1}>
          <Label
            description={message}
            descriptionColor={ColorPalette[TaskType.Plan].description}
            type={TaskType.Plan}
            typeColor={ColorPalette[TaskType.Plan].type}
          />
        </Box>
      )}
      <List
        items={listItems}
        highlightedIndex={currentDefineTaskIndex >= 0 ? highlightedIndex : null}
        highlightedParentIndex={currentDefineTaskIndex}
      />
    </Box>
  );
}
