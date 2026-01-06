import { Box, Text } from 'ink';

import { ExecuteState, TaskData } from '../../types/components.js';

import { getTextColor, Palette } from '../../services/colors.js';
import { ExecutionStatus } from '../../services/shell.js';

import { Spinner } from './Spinner.js';
import { TaskView } from './Task.js';
import { Upcoming, UpcomingStatus } from './Upcoming.js';

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
 * Determine the upcoming status based on task states
 */
function getUpcomingStatus(tasks: TaskData[]): UpcomingStatus {
  const hasFailed = tasks.some(
    (task) => task.status === ExecutionStatus.Failed
  );
  const hasCancelled = tasks.some(
    (task) =>
      task.status === ExecutionStatus.Aborted ||
      task.status === ExecutionStatus.Cancelled
  );

  if (hasFailed) return ExecutionStatus.Failed;
  if (hasCancelled) return ExecutionStatus.Aborted;
  return ExecutionStatus.Pending;
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
  upcoming?: string[];
  label?: string;
}

/**
 * Convert ExecuteState to view props for timeline rendering
 */
export function mapStateToViewProps(
  state: ExecuteState,
  isActive: boolean,
  upcoming?: string[],
  label?: string
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
    upcoming,
    label,
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
  upcoming,
  label,
}: ExecuteViewProps) => {
  // Return null only when loading completes with no commands
  if (!isActive && tasks.length === 0 && !error) {
    return null;
  }

  // Determine upcoming status based on task states
  const upcomingStatus = getUpcomingStatus(tasks);
  const isTerminated = upcomingStatus !== ExecutionStatus.Pending;

  // Show upcoming during active execution or when terminated (to show skipped tasks)
  const showUpcoming =
    upcoming && upcoming.length > 0 && (isActive || isTerminated);

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box flexDirection="column" marginLeft={1}>
          {label && (
            <Box marginBottom={1}>
              <Text color={getTextColor(isActive)}>{label}</Text>
            </Box>
          )}
          <Box marginLeft={label ? 2 : 0}>
            <Text color={Palette.Gray}>Preparing commands. </Text>
            <Spinner />
          </Box>
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
                isActive={isActive}
              />
            </Box>
          ))}
        </Box>
      )}

      {showUpcoming && (
        <Box marginTop={1}>
          <Upcoming items={upcoming} status={upcomingStatus} />
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
