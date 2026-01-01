import { Box, Text } from 'ink';

import { ExecuteState, TaskData } from '../../types/components.js';

import { getTextColor } from '../../services/colors.js';
import { ExecutionStatus } from '../../services/shell.js';

import { Spinner } from './Spinner.js';
import { TaskView } from './Task.js';

/**
 * Check if a task is finished (success, failed, or aborted)
 */
function isTaskFinished(task: TaskData): boolean {
  return (
    task.status === ExecutionStatus.Success ||
    task.status === ExecutionStatus.Failed ||
    task.status === ExecutionStatus.Aborted
  );
}

/**
 * Props for ExecuteView - all display-related data
 */
export interface ExecuteViewProps {
  isLoading: boolean;
  isExecuting: boolean;
  isActive: boolean;
  error: string | null;
  message: string;
  tasks: TaskData[];
  completionMessage: string | null;
  showTasks: boolean;
}

/**
 * Convert ExecuteState to view props for timeline rendering
 */
export function mapStateToViewProps(
  state: ExecuteState,
  isActive: boolean
): ExecuteViewProps {
  return {
    isLoading: false,
    isExecuting: false,
    isActive,
    error: state.error,
    message: state.message,
    tasks: state.tasks,
    completionMessage: state.completionMessage,
    showTasks: state.tasks.length > 0,
  };
}

/**
 * Execute view: Pure display component for task execution progress
 */
export const ExecuteView = ({
  isLoading,
  isExecuting,
  isActive,
  error,
  message,
  tasks,
  completionMessage,
  showTasks,
}: ExecuteViewProps) => {
  // Return null only when loading completes with no commands
  if (!isActive && tasks.length === 0 && !error) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Preparing commands. </Text>
          <Spinner />
        </Box>
      )}

      {(isExecuting || showTasks) && (
        <Box flexDirection="column" marginLeft={1}>
          {message && (
            <Box marginBottom={1} gap={1}>
              <Text color={getTextColor(isActive)}>{message}</Text>
              {isExecuting && <Spinner />}
            </Box>
          )}

          {tasks.map((task, index) => (
            <Box key={index} marginBottom={index < tasks.length - 1 ? 1 : 0}>
              <TaskView
                label={task.label}
                command={task.command}
                status={task.status}
                elapsed={task.elapsed}
                output={task.output}
                isFinished={isTaskFinished(task)}
              />
            </Box>
          ))}
        </Box>
      )}

      {completionMessage && !isActive && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={getTextColor(false)}>{completionMessage}</Text>
        </Box>
      )}

      {error && (
        <Box marginLeft={1}>
          <Text>{error}</Text>
        </Box>
      )}
    </Box>
  );
};
