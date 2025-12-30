import { useCallback, useEffect, useReducer, useRef } from 'react';
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
  buildAbortedState,
  handleTaskCompletion,
  handleTaskFailure,
} from '../execution/handlers.js';
import { processTasks } from '../execution/processing.js';
import { executeReducer, initialState } from '../execution/reducer.js';
import { ExecuteActionType } from '../execution/types.js';
import {
  createFeedback,
  createMessage,
  markAsDone,
} from '../services/components.js';
import { FeedbackType } from '../types/types.js';

import { Message } from './Message.js';
import { Spinner } from './Spinner.js';
import { Task, TaskOutput } from './Task.js';

const MINIMUM_PROCESSING_TIME = 400;

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
    completed: 0,
    completionMessage: null,
    error: null,
    ...overrides,
  };
}

/**
 * Execute view: Displays task execution progress
 */

export interface ExecuteViewProps {
  state: ExecuteState;
  status: ComponentStatus;
  onOutputChange?: (index: number, taskOutput: TaskOutput) => void;
  onTaskComplete?: (
    index: number,
    elapsed: number,
    taskOutput: TaskOutput
  ) => void;
  onTaskAbort?: (index: number, taskOutput: TaskOutput) => void;
  onTaskError?: (
    index: number,
    error: string,
    elapsed: number,
    taskOutput: TaskOutput
  ) => void;
}

export const ExecuteView = ({
  state,
  status,
  onOutputChange,
  onTaskComplete,
  onTaskAbort,
  onTaskError,
}: ExecuteViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { error, tasks, message, completed, completionMessage } = state;
  const hasProcessed = tasks.length > 0;

  // Derive loading state from current conditions
  const isLoading = isActive && tasks.length === 0 && !error && !hasProcessed;
  const isExecuting = completed < tasks.length;

  // Return null only when loading completes with no commands
  if (!isActive && tasks.length === 0 && !error) {
    return null;
  }

  // Show completed steps when not active
  const showTasks = !isActive && tasks.length > 0;

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

          {tasks.map((taskInfo, index) => (
            <Box key={index} marginBottom={index < tasks.length - 1 ? 1 : 0}>
              <Task
                label={taskInfo.label}
                command={taskInfo.command}
                isActive={isActive && index === completed}
                isFinished={index < completed}
                index={index}
                initialStatus={taskInfo.status}
                initialElapsed={taskInfo.elapsed}
                initialOutput={
                  taskInfo.stdout || taskInfo.stderr || taskInfo.error
                    ? {
                        stdout: taskInfo.stdout ?? '',
                        stderr: taskInfo.stderr ?? '',
                        error: taskInfo.error ?? '',
                      }
                    : undefined
                }
                onOutputChange={onOutputChange}
                onComplete={onTaskComplete}
                onAbort={onTaskAbort}
                onError={onTaskError}
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

      {error && <Message text={error} status={status} />}
    </Box>
  );
};

/**
 * Execute controller: Runs tasks sequentially
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

  // Ref to store current output for each task (avoids re-renders)
  const taskOutputRef = useRef<Map<number, TaskOutput>>(new Map());

  const {
    error,
    tasks,
    message,
    completed,
    hasProcessed,
    completionMessage,
    summary,
  } = localState;

  // Derive loading state from current conditions
  const isLoading = isActive && tasks.length === 0 && !error && !hasProcessed;

  const isExecuting = completed < tasks.length;

  // Handle output changes from Task - store in ref (no re-render)
  const handleOutputChange = useCallback(
    (index: number, taskOutput: TaskOutput) => {
      taskOutputRef.current.set(index, taskOutput);
    },
    []
  );

  // Handle cancel with useCallback to ensure we capture latest state
  const handleCancel = useCallback(() => {
    dispatch({
      type: ExecuteActionType.CancelExecution,
      payload: { completed },
    });

    // Get updated task infos after cancel, merging output from ref
    const updatedTaskInfos = tasks.map((task, taskIndex) => {
      const output = taskOutputRef.current.get(taskIndex);
      const baseTask = output
        ? {
            ...task,
            stdout: output.stdout,
            stderr: output.stderr,
            error: output.error,
          }
        : task;

      if (taskIndex < completed) {
        return { ...baseTask, status: ExecutionStatus.Success };
      } else if (taskIndex === completed) {
        return { ...baseTask, status: ExecutionStatus.Aborted };
      } else {
        return { ...baseTask, status: ExecutionStatus.Cancelled };
      }
    });

    // Expose final state
    const finalState = createExecuteState({
      message,
      summary,
      tasks: updatedTaskInfos,
      completed,
    });
    requestHandlers.onCompleted(finalState);

    requestHandlers.onAborted('execution');
  }, [message, summary, tasks, completed, requestHandlers]);

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting) && isActive) {
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
          // Check if this is an error response (has error field)
          if (result.error) {
            // Add error message to timeline
            const errorMessage = getExecutionErrorMessage(result.error);
            workflowHandlers.addToTimeline(
              markAsDone(createMessage(errorMessage))
            );

            // Complete without error in state (message already in timeline)
            requestHandlers.onCompleted(
              createExecuteState({ message: result.message })
            );
            lifecycleHandlers.completeActive();
            return;
          }

          // No commands and no error - just complete
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
        const tasks = result.commands.map(
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
            tasks,
          },
        });

        // Update state after AI processing
        requestHandlers.onCompleted(
          createExecuteState({
            message: result.message,
            summary: result.summary,
            tasks,
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

  // Handle task completion - move to next task
  const handleTaskComplete = useCallback(
    (index: number, elapsed: number, taskOutput: TaskOutput) => {
      // Update tasks with output before calling handler
      const tasksWithOutput = tasks.map((task, i) =>
        i === index
          ? {
              ...task,
              stdout: taskOutput.stdout,
              stderr: taskOutput.stderr,
              error: taskOutput.error,
            }
          : task
      );

      const result = handleTaskCompletion(index, elapsed, {
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
    [tasks, message, summary, requestHandlers, lifecycleHandlers]
  );

  const handleTaskError = useCallback(
    (index: number, error: string, elapsed: number, taskOutput: TaskOutput) => {
      // Update tasks with output before calling handler
      const tasksWithOutput = tasks.map((task, i) =>
        i === index
          ? {
              ...task,
              stdout: taskOutput.stdout,
              stderr: taskOutput.stderr,
              error: taskOutput.error,
            }
          : task
      );

      const result = handleTaskFailure(index, error, elapsed, {
        tasks: tasksWithOutput,
        message,
        summary,
      });

      dispatch(result.action);
      requestHandlers.onCompleted(result.finalState);

      // Add error feedback to queue for critical failures
      if (result.action.type === ExecuteActionType.TaskErrorCritical) {
        const errorMessage = getExecutionErrorMessage(error);
        workflowHandlers.addToQueue(
          createFeedback(FeedbackType.Failed, errorMessage)
        );
      }

      if (result.shouldComplete) {
        lifecycleHandlers.completeActive();
      }
    },
    [
      tasks,
      message,
      summary,
      requestHandlers,
      lifecycleHandlers,
      workflowHandlers,
    ]
  );

  const handleTaskAbort = useCallback(
    (index: number, taskOutput: TaskOutput) => {
      // Task was aborted - execution already stopped by Escape handler
      // Update tasks with output before building state
      const tasksWithOutput = tasks.map((task, i) =>
        i === index
          ? {
              ...task,
              stdout: taskOutput.stdout,
              stderr: taskOutput.stderr,
              error: taskOutput.error,
            }
          : task
      );

      const finalState = buildAbortedState(
        tasksWithOutput,
        message,
        summary,
        completed
      );

      requestHandlers.onCompleted(finalState);
    },
    [tasks, message, summary, completed, requestHandlers]
  );

  // Controller always renders View with current state
  const viewState = createExecuteState({
    error,
    tasks,
    message,
    summary,
    completed,
    completionMessage,
  });

  return (
    <ExecuteView
      state={viewState}
      status={status}
      onOutputChange={handleOutputChange}
      onTaskComplete={handleTaskComplete}
      onTaskAbort={handleTaskAbort}
      onTaskError={handleTaskError}
    />
  );
}
