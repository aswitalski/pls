import { useCallback, useEffect, useReducer } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentStatus,
  ExecuteProps,
  ExecuteState,
} from '../types/components.js';
import { Task as TaskType } from '../types/types.js';

import { getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { CommandOutput, ExecutionStatus } from '../services/shell.js';
import { ensureMinimumTime } from '../services/timing.js';

import {
  buildAbortedState,
  handleTaskCompletion,
  handleTaskFailure,
} from '../execution/handlers.js';
import { processTasks } from '../execution/processing.js';
import { executeReducer, initialState } from '../execution/reducer.js';
import { ExecuteActionType } from '../execution/types.js';

import { Message } from './Message.js';
import { Spinner } from './Spinner.js';
import { Task } from './Task.js';

const MINIMUM_PROCESSING_TIME = 400;

/**
 * Execute view: Displays task execution progress
 */

export interface ExecuteViewProps {
  tasks: TaskType[];
  state: ExecuteState;
  status: ComponentStatus;
  onTaskComplete?: (
    index: number,
    output: CommandOutput,
    elapsed: number
  ) => void;
  onTaskAbort?: (index: number) => void;
  onTaskError?: (index: number, error: string, elapsed: number) => void;
}

export const ExecuteView = ({
  state,
  status,
  onTaskComplete,
  onTaskAbort,
  onTaskError,
}: ExecuteViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { error, taskInfos, message, completed, completionMessage } = state;
  const hasProcessed = taskInfos.length > 0;

  // Derive loading state from current conditions
  const isLoading =
    isActive && taskInfos.length === 0 && !error && !hasProcessed;
  const isExecuting = completed < taskInfos.length;

  // Return null only when loading completes with no commands
  if (!isActive && taskInfos.length === 0 && !error) {
    return null;
  }

  // Show completed steps when not active
  const showTasks = !isActive && taskInfos.length > 0;

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

          {taskInfos.map((taskInfo, index) => (
            <Box
              key={index}
              marginBottom={index < taskInfos.length - 1 ? 1 : 0}
            >
              <Task
                label={taskInfo.label}
                command={taskInfo.command}
                isActive={isActive && index === completed}
                index={index}
                initialStatus={taskInfo.status}
                initialElapsed={taskInfo.elapsed}
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
  tasks,
  status,
  service,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: ExecuteProps) {
  const isActive = status === ComponentStatus.Active;
  const [localState, dispatch] = useReducer(executeReducer, initialState);

  const {
    error,
    taskInfos,
    message,
    completed,
    hasProcessed,
    taskExecutionTimes,
    completionMessage,
    summary,
  } = localState;

  // Derive loading state from current conditions
  const isLoading =
    isActive && taskInfos.length === 0 && !error && !hasProcessed;

  const isExecuting = completed < taskInfos.length;

  // Handle cancel with useCallback to ensure we capture latest state
  const handleCancel = useCallback(() => {
    dispatch({
      type: ExecuteActionType.CancelExecution,
      payload: { completed },
    });

    // Get updated task infos after cancel
    const updatedTaskInfos = taskInfos.map((task, taskIndex) => {
      if (taskIndex < completed) {
        return { ...task, status: ExecutionStatus.Success };
      } else if (taskIndex === completed) {
        return { ...task, status: ExecutionStatus.Aborted };
      } else {
        return { ...task, status: ExecutionStatus.Cancelled };
      }
    });

    // Expose final state
    const finalState: ExecuteState = {
      message,
      summary,
      taskInfos: updatedTaskInfos,
      completed,
      taskExecutionTimes,
      completionMessage: null,
      error: null,
    };
    requestHandlers.onCompleted(finalState);

    requestHandlers.onAborted('execution');
  }, [
    message,
    summary,
    taskInfos,
    completed,
    taskExecutionTimes,
    requestHandlers,
  ]);

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
    if (!isActive || taskInfos.length > 0 || hasProcessed) {
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        const result = await processTasks(tasks, svc);

        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (!mounted) return;

        // Add debug components to timeline if present
        if (result.debug?.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }

        if (result.commands.length === 0) {
          dispatch({
            type: ExecuteActionType.ProcessingComplete,
            payload: { message: result.message },
          });
          const finalState: ExecuteState = {
            message: result.message,
            summary: '',
            taskInfos: [],
            completed: 0,
            taskExecutionTimes: [],
            completionMessage: null,
            error: null,
          };
          requestHandlers.onCompleted(finalState);
          lifecycleHandlers.completeActive();
          return;
        }

        // Create task infos from commands
        const infos = result.commands.map((cmd, index) => ({
          label: tasks[index]?.action,
          command: cmd,
        }));

        dispatch({
          type: ExecuteActionType.CommandsReady,
          payload: {
            message: result.message,
            summary: result.summary,
            taskInfos: infos,
          },
        });

        // Update state after AI processing
        const finalState: ExecuteState = {
          message: result.message,
          summary: result.summary,
          taskInfos: infos,
          completed: 0,
          taskExecutionTimes: [],
          completionMessage: null,
          error: null,
        };
        requestHandlers.onCompleted(finalState);
      } catch (err) {
        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          dispatch({
            type: ExecuteActionType.ProcessingError,
            payload: { error: errorMessage },
          });
          const finalState: ExecuteState = {
            message: '',
            summary: '',
            taskInfos: [],
            completed: 0,
            taskExecutionTimes: [],
            completionMessage: null,
            error: errorMessage,
          };
          requestHandlers.onCompleted(finalState);
          requestHandlers.onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [
    tasks,
    isActive,
    service,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,

    taskInfos.length,
    hasProcessed,
  ]);

  // Handle task completion - move to next task
  const handleTaskComplete = useCallback(
    (index: number, _output: CommandOutput, elapsed: number) => {
      const result = handleTaskCompletion(index, elapsed, {
        taskInfos,
        message,
        summary,
        taskExecutionTimes,
      });

      dispatch(result.action);
      requestHandlers.onCompleted(result.finalState);

      if (result.shouldComplete) {
        lifecycleHandlers.completeActive();
      }
    },
    [
      taskInfos,
      message,
      summary,
      taskExecutionTimes,
      requestHandlers,
      lifecycleHandlers,
    ]
  );

  const handleTaskError = useCallback(
    (index: number, error: string, elapsed: number) => {
      const result = handleTaskFailure(index, error, elapsed, {
        taskInfos,
        message,
        summary,
        taskExecutionTimes,
      });

      dispatch(result.action);
      requestHandlers.onCompleted(result.finalState);

      if (result.shouldReportError) {
        requestHandlers.onError(error);
      }

      if (result.shouldComplete) {
        lifecycleHandlers.completeActive();
      }
    },
    [
      taskInfos,
      message,
      summary,
      taskExecutionTimes,
      requestHandlers,
      lifecycleHandlers,
    ]
  );

  const handleTaskAbort = useCallback(
    (_index: number) => {
      // Task was aborted - execution already stopped by Escape handler
      // Just update state, don't call onAborted (already called at Execute level)
      const finalState = buildAbortedState(
        taskInfos,
        message,
        summary,
        completed,
        taskExecutionTimes
      );
      requestHandlers.onCompleted(finalState);
    },
    [
      taskInfos,
      message,
      summary,
      completed,
      taskExecutionTimes,
      requestHandlers,
    ]
  );

  // Controller always renders View with current state
  const viewState: ExecuteState = {
    error,
    taskInfos,
    message,
    summary,
    completed,
    taskExecutionTimes,
    completionMessage,
  };

  return (
    <ExecuteView
      tasks={tasks}
      state={viewState}
      status={status}
      onTaskComplete={handleTaskComplete}
      onTaskAbort={handleTaskAbort}
      onTaskError={handleTaskError}
    />
  );
}
