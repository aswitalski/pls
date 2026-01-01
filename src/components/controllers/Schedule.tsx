import { useEffect, useState } from 'react';

import {
  ComponentStatus,
  ScheduleProps,
  ScheduleState,
} from '../../types/components.js';
import { Task, TaskType } from '../../types/types.js';

import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';

import { ScheduleView } from '../views/Schedule.js';

export {
  ScheduleView,
  ScheduleViewProps,
  taskToListItem,
} from '../views/Schedule.js';

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

  return (
    <ScheduleView
      status={status}
      message={message}
      tasks={tasks}
      highlightedIndex={highlightedIndex}
      currentDefineGroupIndex={currentDefineGroupIndex}
      completedSelections={completedSelections}
      debug={debug}
    />
  );
}
