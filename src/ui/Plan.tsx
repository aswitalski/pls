import { Box, Text } from 'ink';

import { Task, TaskType } from '../types/components.js';

import { Label } from './Label.js';
import { List } from './List.js';

const ColorPalette: Record<TaskType, { description: string; type: string }> = {
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
};

function taskToListItem(task: Task) {
  const item: {
    description: { text: string; color: string };
    type: { text: string; color: string };
    children: {
      description: { text: string; color: string };
      type: { text: string; color: string };
    }[];
  } = {
    description: {
      text: task.action,
      color: ColorPalette[task.type].description,
    },
    type: { text: task.type, color: ColorPalette[task.type].type },
    children: [],
  };

  // Add children for Define tasks with options
  if (task.type === TaskType.Define && Array.isArray(task.params?.options)) {
    const selectColors = ColorPalette[TaskType.Select];
    item.children = (task.params.options as string[]).map((option) => ({
      description: {
        text: String(option),
        color: selectColors.description,
      },
      type: {
        text: TaskType.Select,
        color: selectColors.type,
      },
    }));
  }

  return item;
}

export interface PlanProps {
  message?: string;
  tasks: Task[];
}

export function Plan({ message, tasks }: PlanProps) {
  return (
    <Box marginLeft={1} flexDirection="column">
      {message && (
        <Box marginBottom={1}>
          <Text> </Text>
          <Label
            description={message}
            descriptionColor={ColorPalette[TaskType.Plan].description}
            type={TaskType.Plan}
            typeColor={ColorPalette[TaskType.Plan].type}
          />
        </Box>
      )}
      <List items={tasks.map(taskToListItem)} />
    </Box>
  );
}
