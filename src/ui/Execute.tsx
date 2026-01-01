import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentStatus,
  ExecuteProps,
  ExecuteState,
  TaskInfo,
} from '../types/components.js';

import { getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import {
  formatErrorMessage,
  getExecutionErrorMessage,
} from '../services/messages.js';
import { ExecutionStatus } from '../services/shell.js';
import { ensureMinimumTime } from '../services/timing.js';

import {
  handleTaskCompletion,
  handleTaskFailure,
} from '../execution/handlers.js';
import { processTasks } from '../execution/processing.js';
import { executeReducer, initialState } from '../execution/reducer.js';
import { executeTask, TaskOutput } from '../execution/runner.js';
import { ExecuteActionType } from '../execution/types.js';
import { getCurrentTaskIndex } from '../execution/utils.js';
import { createFeedback, createMessage } from '../services/components.js';
import { FeedbackType } from '../types/types.js';

import { Spinner } from './Spinner.js';
import { TaskView } from './Task.js';
import { ExecuteCommand } from '../services/anthropic.js';

const MINIMUM_PROCESSING_TIME = 400;
const ELAPSED_UPDATE_INTERVAL = 1000;

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

  // Live output state for currently executing task
  const [liveOutput, setLiveOutput] = useState<TaskOutput>({
    stdout: '',
    stderr: '',
    error: '',
  });
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);

  // Track working directory across commands (persists cd changes)
  const workdirRef = useRef<string | undefined>(undefined);

  // Ref to track if current task execution is cancelled
  const cancelledRef = useRef(false);

  const { error, tasks, message, hasProcessed, completionMessage, summary } =
    localState;

  // Derive current task index from tasks
  const currentTaskIndex = getCurrentTaskIndex(tasks);

  // Derive states
  const isLoading = isActive && tasks.length === 0 && !error && !hasProcessed;
  const isExecuting = isActive && currentTaskIndex < tasks.length;
  const showTasks = !isActive && tasks.length > 0;

  // Update elapsed time while task is running
  useEffect(() => {
    if (!taskStartTime || !isExecuting) return;

    const interval = setInterval(() => {
      setLiveElapsed(Date.now() - taskStartTime);
    }, ELAPSED_UPDATE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [taskStartTime, isExecuting]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelledRef.current = true;

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
  }, [message, summary, tasks, liveOutput, requestHandlers]);

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting)) {
        handleCancel();
      }
    },
    { isActive: (isLoading || isExecuting) && isActive }
  );

  // Process tasks to get commands from AI
  useEffect(() => {
    if (!isActive || tasks.length > 0 || hasProcessed) {
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        const result = await processTasks(inputTasks, svc);

        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (!mounted) return;

        // Add debug components to timeline if present
        if (result.debug?.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }

        if (result.commands.length === 0) {
          if (result.error) {
            const errorMessage = getExecutionErrorMessage(result.error);
            workflowHandlers.addToTimeline(
              createMessage({ text: errorMessage }, ComponentStatus.Done)
            );
            requestHandlers.onCompleted(
              createExecuteState({ message: result.message })
            );
            lifecycleHandlers.completeActive();
            return;
          }

          dispatch({
            type: ExecuteActionType.ProcessingComplete,
            payload: { message: result.message },
          });
          requestHandlers.onCompleted(
            createExecuteState({ message: result.message })
          );
          lifecycleHandlers.completeActive();
          return;
        }

        // Create task infos from commands
        const taskInfos = result.commands.map(
          (cmd, index) =>
            ({
              label: inputTasks[index]?.action ?? cmd.description,
              command: cmd,
              status: ExecutionStatus.Pending,
              elapsed: 0,
            }) as TaskInfo
        );

        dispatch({
          type: ExecuteActionType.CommandsReady,
          payload: {
            message: result.message,
            summary: result.summary,
            tasks: taskInfos,
          },
        });

        requestHandlers.onCompleted(
          createExecuteState({
            message: result.message,
            summary: result.summary,
            tasks: taskInfos,
          })
        );
      } catch (err) {
        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          dispatch({
            type: ExecuteActionType.ProcessingError,
            payload: { error: errorMessage },
          });
          requestHandlers.onCompleted(
            createExecuteState({ error: errorMessage })
          );
          requestHandlers.onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [
    inputTasks,
    isActive,
    service,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
    tasks.length,
    hasProcessed,
  ]);

  // Execute current task
  useEffect(() => {
    if (
      !isActive ||
      tasks.length === 0 ||
      currentTaskIndex >= tasks.length ||
      error
    ) {
      return;
    }

    const currentTask = tasks[currentTaskIndex];
    if (currentTask.status !== ExecutionStatus.Pending) {
      return;
    }

    cancelledRef.current = false;

    // Mark task as started (running)
    dispatch({
      type: ExecuteActionType.TaskStarted,
      payload: { index: currentTaskIndex },
    });

    // Reset live state for new task
    setLiveOutput({ stdout: '', stderr: '', error: '' });
    setLiveElapsed(0);
    setTaskStartTime(Date.now());

    // Merge workdir into command
    const command = workdirRef.current
      ? { ...currentTask.command, workdir: workdirRef.current }
      : currentTask.command;

    void executeTask(command, currentTaskIndex, {
      onOutputChange: (output) => {
        if (!cancelledRef.current) {
          setLiveOutput(output);
        }
      },
      onComplete: (elapsed, output) => {
        if (cancelledRef.current) return;

        setTaskStartTime(null);

        // Track working directory
        if (output.workdir) {
          workdirRef.current = output.workdir;
        }

        const tasksWithOutput = tasks.map((task, i) =>
          i === currentTaskIndex
            ? {
                ...task,
                stdout: output.stdout,
                stderr: output.stderr,
                error: output.error,
              }
            : task
        );

        const result = handleTaskCompletion(currentTaskIndex, elapsed, {
          tasks: tasksWithOutput,
          message,
          summary,
        });

        dispatch(result.action);
        requestHandlers.onCompleted(result.finalState);

        if (result.shouldComplete) {
          lifecycleHandlers.completeActive();
        }
      },
      onError: (errorMsg, elapsed, output) => {
        if (cancelledRef.current) return;

        setTaskStartTime(null);

        // Track working directory
        if (output.workdir) {
          workdirRef.current = output.workdir;
        }

        const tasksWithOutput = tasks.map((task, i) =>
          i === currentTaskIndex
            ? {
                ...task,
                stdout: output.stdout,
                stderr: output.stderr,
                error: output.error,
              }
            : task
        );

        const result = handleTaskFailure(currentTaskIndex, errorMsg, elapsed, {
          tasks: tasksWithOutput,
          message,
          summary,
        });

        dispatch(result.action);
        requestHandlers.onCompleted(result.finalState);

        if (result.action.type === ExecuteActionType.TaskErrorCritical) {
          const errorMessage = getExecutionErrorMessage(errorMsg);
          workflowHandlers.addToQueue(
            createFeedback({ type: FeedbackType.Failed, message: errorMessage })
          );
        }

        if (result.shouldComplete) {
          lifecycleHandlers.completeActive();
        }
      },
    });
  }, [
    isActive,
    tasks,
    currentTaskIndex,
    message,
    summary,
    error,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  ]);

  // Build view data for each task
  const taskViewData: TaskViewData[] = tasks.map((task) => {
    const isTaskActive = isActive && task.status === ExecutionStatus.Running;
    const finished = isTaskFinished(task);

    // Use live output for active task, stored output for finished tasks
    const stdout = isTaskActive ? liveOutput.stdout : (task.stdout ?? '');
    const stderr = isTaskActive ? liveOutput.stderr : (task.stderr ?? '');

    // Use live elapsed for active running task
    const elapsed = isTaskActive ? liveElapsed : task.elapsed;

    // Merge workdir for active task
    const command =
      isTaskActive && workdirRef.current
        ? { ...task.command, workdir: workdirRef.current }
        : task.command;

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
