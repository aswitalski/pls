import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { CommandProps, Task, TaskType } from '../types/components.js';

import { List } from './List.js';
import { Separator } from './Separator.js';
import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000; // purely for visual effect

type ColoredText = { text: string; color: string };

// Color palette
const ColorPalette: Record<TaskType, { description: string; type: string }> = {
  [TaskType.Config]: {
    description: '#ffffff', // white
    type: '#5c9ccc', // cyan
  },
  [TaskType.Plan]: {
    description: '#ffffff', // white
    type: '#cc5c9c', // magenta
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
  const colors = ColorPalette[task.type];

  const item: {
    description: ColoredText;
    type: ColoredText;
    children?: {
      description: ColoredText;
      type: ColoredText;
    }[];
  } = {
    description: {
      text: task.action,
      color: colors.description,
    },
    type: {
      text: task.type,
      color: colors.type,
    },
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

export function Command({
  command,
  state,
  service,
  error: errorProp,
  children,
}: CommandProps) {
  const done = state?.done ?? false;
  const [error, setError] = useState<string | null>(
    state?.error || errorProp || null
  );
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? !done);
  const [message, setMessage] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Skip processing if done (showing historical/final state)
    if (done) {
      return;
    }

    // Skip processing if no service available
    if (!service) {
      setError('No service available');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        const result = await svc!.processWithTool(command, 'plan');
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          setMessage(result.message);
          setTasks(result.tasks);
          setIsLoading(false);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Unknown error occurred'
          );
          setIsLoading(false);
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [command, done, service]);

  return (
    <Box alignSelf="flex-start" marginBottom={1} flexDirection="column">
      <Box>
        <Text color="gray">&gt; pls {command}</Text>
        {isLoading && (
          <>
            <Text> </Text>
            <Spinner />
          </>
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {!isLoading && tasks.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {message && (
            <Box marginBottom={1}>
              <Text> {message}</Text>
              <Separator color="#9c5ccc" />
              <Text color="#9c5ccc">plan</Text>
            </Box>
          )}
          <List items={tasks.map(taskToListItem)} />
        </Box>
      )}

      {children}
    </Box>
  );
}
