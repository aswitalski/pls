import { useCallback, useMemo, useReducer, useState } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentStatus,
  ExecuteProps,
  ExecuteState,
  TaskInfo,
} from '../types/components.js';

import { ExecuteCommand } from '../services/anthropic.js';
import { getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { ExecutionStatus } from '../services/shell.js';

import {
  useCancellation,
  useElapsedTimer,
  useLiveTaskOutput,
  useTaskExecutor,
  useTaskProcessor,
} from '../execution/hooks.js';
import { executeReducer, initialState } from '../execution/reducer.js';
import { ExecuteActionType } from '../execution/types.js';
import { getCurrentTaskIndex } from '../execution/utils.js';

import { Spinner } from './Spinner.js';
import { TaskView } from './Task.js';

/**
 * Check if a task is finished (success, failed, or aborted)
 */
function isTaskFinished(task: TaskInfo): boolean {
  return (
    task.status === ExecutionStatus.Success ||
    task.status === ExecutionStatus.Failed ||
    task.status === ExecutionStatus.Aborted
  );
}

/**
 * Map ExecuteState to view props for rendering in timeline
 */
export function mapStateToViewProps(
  state: ExecuteState,
  isActive: boolean
): ExecuteViewProps {
  const taskViewData: TaskViewData[] = state.tasks.map((task) => {
    return {
      label: task.label,
      command: task.command,
      status: task.status,
      elapsed: task.elapsed,
      stdout: task.stdout ?? '',
      stderr: task.stderr ?? '',
      isActive: false, // In timeline, no task is active
      isFinished: isTaskFinished(task),
    };
  });

  return {
    isLoading: false,
    isExecuting: false,
    isActive,
    error: state.error,
    message: state.message,
    tasks: taskViewData,
    completionMessage: state.completionMessage,
    showTasks: state.tasks.length > 0,
  };
}

/**
 * Create an ExecuteState with defaults
 */
function createExecuteState(
  overrides: Partial<ExecuteState> = {}
): ExecuteState {
  return {
    message: '',
    summary: '',
    tasks: [],
    completionMessage: null,
    error: null,
    ...overrides,
  };
}

/**
 * Build view data for rendering tasks
 */
function buildTaskViewData(
  tasks: TaskInfo[],
  isActive: boolean,
  liveOutput: { stdout: string; stderr: string },
  liveElapsed: number,
  workdir: string | undefined
): TaskViewData[] {
  return tasks.map((task) => {
    const isTaskActive = isActive && task.status === ExecutionStatus.Running;
    const finished = isTaskFinished(task);

    // Use live output for active task, stored output for finished tasks
    const stdout = isTaskActive ? liveOutput.stdout : (task.stdout ?? '');
    const stderr = isTaskActive ? liveOutput.stderr : (task.stderr ?? '');

    // Use live elapsed for active running task
    const elapsed = isTaskActive ? liveElapsed : task.elapsed;

    // Merge workdir for active task
    const command =
      isTaskActive && workdir ? { ...task.command, workdir } : task.command;

    return {
      label: task.label,
      command,
      status: task.status,
      elapsed,
      stdout,
      stderr,
      isActive: isTaskActive,
      isFinished: finished,
    };
  });
}

/**
 * Data for rendering a single task in the view
 */
export interface TaskViewData {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  elapsed?: number;
  stdout: string;
  stderr: string;
  isActive: boolean;
  isFinished: boolean;
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
  tasks: TaskViewData[];
  completionMessage: string | null;
  showTasks: boolean;
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
                stdout={task.stdout}
                stderr={task.stderr}
                isFinished={task.isFinished}
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

/**
 * Execute controller: Runs tasks sequentially and manages all execution state
 */
export function Execute({
  tasks: inputTasks,
  status,
  service,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: ExecuteProps) {
  const isActive = status === ComponentStatus.Active;
  const [localState, dispatch] = useReducer(executeReducer, initialState);

  // Live output tracking for currently executing task
  const liveTaskOutput = useLiveTaskOutput();
  const { output: liveOutput, startTime: taskStartTime } = liveTaskOutput;

  // Track working directory across commands (persists cd changes)
  const [workdir, setWorkdir] = useState<string | undefined>(undefined);

  // Cancellation handling
  const { cancelledRef, cancel: markCancelled } = useCancellation();

  const { error, tasks, message, hasProcessed, completionMessage, summary } =
    localState;

  // Derive current task index from tasks
  const currentTaskIndex = getCurrentTaskIndex(tasks);

  // Derive states
  const isLoading = isActive && tasks.length === 0 && !error && !hasProcessed;
  const isExecuting = isActive && currentTaskIndex < tasks.length;
  const showTasks = !isActive && tasks.length > 0;

  // Update elapsed time while task is running
  const liveElapsed = useElapsedTimer(taskStartTime, isExecuting);

  // Handle cancel
  const handleCancel = useCallback(() => {
    markCancelled();

    dispatch({ type: ExecuteActionType.CancelExecution });

    // Build updated task infos with current output for the running task
    const updatedTaskInfos = tasks.map((task) => {
      if (task.status === ExecutionStatus.Running) {
        return {
          ...task,
          status: ExecutionStatus.Aborted,
          stdout: liveOutput.stdout,
          stderr: liveOutput.stderr,
          error: liveOutput.error,
        };
      } else if (task.status === ExecutionStatus.Pending) {
        return { ...task, status: ExecutionStatus.Cancelled };
      }
      return task;
    });

    const finalState = createExecuteState({
      message,
      summary,
      tasks: updatedTaskInfos,
    });
    requestHandlers.onCompleted(finalState);
    requestHandlers.onAborted('execution');
  }, [message, summary, tasks, liveOutput, requestHandlers, markCancelled]);

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting)) {
        handleCancel();
      }
    },
    { isActive: (isLoading || isExecuting) && isActive }
  );

  // Process tasks to get commands from AI
  useTaskProcessor({
    inputTasks,
    service,
    isActive,
    hasProcessed,
    tasksCount: tasks.length,
    dispatch,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  });

  // Execute tasks sequentially
  useTaskExecutor({
    isActive,
    tasks,
    message,
    summary,
    error,
    workdir,
    setWorkdir,
    cancelledRef,
    liveOutput: liveTaskOutput,
    dispatch,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  });

  // Build view data for rendering
  const taskViewData = useMemo(
    () => buildTaskViewData(tasks, isActive, liveOutput, liveElapsed, workdir),
    [tasks, isActive, liveOutput, liveElapsed, workdir]
  );

  return (
    <ExecuteView
      isLoading={isLoading}
      isExecuting={isExecuting}
      isActive={isActive}
      error={error}
      message={message}
      tasks={taskViewData}
      completionMessage={completionMessage}
      showTasks={showTasks}
    />
  );
}
