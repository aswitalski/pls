import { Box } from 'ink';

import { ComponentStatus } from '../../types/components.js';
import { ScheduledTask, Task, TaskType } from '../../types/types.js';

import { DebugLevel } from '../../configuration/types.js';
import {
  getTaskColors,
  getTaskTypeLabel,
  Palette,
} from '../../services/colors.js';

import { Label } from './Label.js';
import { List } from './List.js';

export function taskToListItem(
  task: Task,
  highlightedChildIndex: number | null = null,
  isDefineTaskWithoutSelection: boolean = false,
  status: ComponentStatus = ComponentStatus.Done,
  debug: DebugLevel = DebugLevel.None
) {
  const taskColors = getTaskColors(task.type, status);

  // Determine description color based on status
  let descriptionColor = taskColors.description;
  if (status === ComponentStatus.Pending) {
    descriptionColor = Palette.SoftWhite;
  }

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
      color: descriptionColor,
    },
    type: { text: getTaskTypeLabel(task.type, debug), color: taskColors.type },
    children: [],
  };

  // Mark define tasks with right arrow when no selection has been made
  if (isDefineTaskWithoutSelection) {
    item.marker = '  → ';
    item.markerColor = getTaskColors(TaskType.Schedule, status).type;
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

      const colors = getTaskColors(childType, status);
      const planColors = getTaskColors(TaskType.Schedule, status);
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
      const subtaskColors = getTaskColors(subtask.type, status);
      return {
        description: {
          text: subtask.action,
          color: Palette.AshGray,
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
 * Props for ScheduleView - display-ready data
 */
export interface ScheduleViewProps {
  status: ComponentStatus;
  message: string;
  tasks: Task[];
  highlightedIndex: number | null;
  currentDefineGroupIndex: number;
  completedSelections: number[];
  debug?: DebugLevel;
}

/**
 * Schedule view: Displays task list with navigation
 */
export const ScheduleView = ({
  status,
  message,
  tasks,
  highlightedIndex,
  currentDefineGroupIndex,
  completedSelections,
  debug = DebugLevel.None,
}: ScheduleViewProps) => {
  const isActive = status === ComponentStatus.Active;

  // Use compact mode when all tasks are Config type
  const isCompact = tasks.every((task) => task.type === TaskType.Config);

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
      status,
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
            status={status}
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
          compact={isCompact}
        />
      </Box>
    </Box>
  );
};
