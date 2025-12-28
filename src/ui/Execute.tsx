import { useCallback, useEffect, useReducer } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentStatus,
  ExecuteProps,
  ExecuteState,
  TaskInfo,
} from '../types/components.js';
import { Task as TaskType } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { loadUserConfig } from '../services/loader.js';
import { formatErrorMessage } from '../services/messages.js';
import { replacePlaceholders } from '../services/resolver.js';
import { CommandOutput, ExecutionStatus } from '../services/shell.js';
import { ensureMinimumTime } from '../services/timing.js';
import { formatDuration } from '../services/utils.js';

import { Spinner } from './Spinner.js';
import { Task } from './Task.js';

const MINIMUM_PROCESSING_TIME = 400;

/**
 * Validates that all placeholders in a command have been resolved.
 * Throws an error if unresolved placeholders are found.
 */
function validatePlaceholderResolution(
  command: string,
  original: string
): void {
  const unresolvedPattern = /\{[^}]+\}/g;
  const matches = command.match(unresolvedPattern);

  if (matches && matches.length > 0) {
    throw new Error(
      `Unresolved placeholders in command: ${matches.join(', ')}\nCommand: ${original}`
    );
  }
}

type ExecuteAction =
  | { type: 'PROCESSING_COMPLETE'; payload: { message: string } }
  | {
      type: 'COMMANDS_READY';
      payload: {
        message: string;
        summary: string;
        taskInfos: TaskInfo[];
      };
    }
  | { type: 'PROCESSING_ERROR'; payload: { error: string } }
  | { type: 'TASK_COMPLETE'; payload: { index: number; elapsed: number } }
  | {
      type: 'ALL_TASKS_COMPLETE';
      payload: { index: number; elapsed: number; summaryText: string };
    }
  | { type: 'TASK_ERROR_CRITICAL'; payload: { index: number; error: string } }
  | {
      type: 'TASK_ERROR_CONTINUE';
      payload: { index: number; elapsed: number };
    }
  | {
      type: 'LAST_TASK_ERROR';
      payload: { index: number; elapsed: number; summaryText: string };
    }
  | { type: 'CANCEL_EXECUTION'; payload: { completed: number } };

// Internal state for reducer - extends ExecuteState with hasProcessed
interface InternalExecuteState extends ExecuteState {
  hasProcessed: boolean;
}

function executeReducer(
  state: InternalExecuteState,
  action: ExecuteAction
): InternalExecuteState {
  switch (action.type) {
    case 'PROCESSING_COMPLETE':
      return {
        ...state,
        message: action.payload.message,
        hasProcessed: true,
      };

    case 'COMMANDS_READY':
      return {
        ...state,
        message: action.payload.message,
        summary: action.payload.summary,
        taskInfos: action.payload.taskInfos,
        completed: 0,
      };

    case 'PROCESSING_ERROR':
      return {
        ...state,
        error: action.payload.error,
        hasProcessed: true,
      };

    case 'TASK_COMPLETE': {
      const updatedTimes = [
        ...state.taskExecutionTimes,
        action.payload.elapsed,
      ];
      const updatedTaskInfos = state.taskInfos.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Success,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      return {
        ...state,
        taskInfos: updatedTaskInfos,
        taskExecutionTimes: updatedTimes,
        completed: action.payload.index + 1,
      };
    }

    case 'ALL_TASKS_COMPLETE': {
      const updatedTimes = [
        ...state.taskExecutionTimes,
        action.payload.elapsed,
      ];
      const updatedTaskInfos = state.taskInfos.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Success,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      const totalElapsed = updatedTimes.reduce((sum, time) => sum + time, 0);
      const completion = `${action.payload.summaryText} in ${formatDuration(totalElapsed)}.`;
      return {
        ...state,
        taskInfos: updatedTaskInfos,
        taskExecutionTimes: updatedTimes,
        completed: action.payload.index + 1,
        completionMessage: completion,
      };
    }

    case 'TASK_ERROR_CRITICAL': {
      const updatedTaskInfos = state.taskInfos.map((task, i) =>
        i === action.payload.index
          ? { ...task, status: ExecutionStatus.Failed, elapsed: 0 }
          : task
      );
      return {
        ...state,
        taskInfos: updatedTaskInfos,
        error: action.payload.error,
      };
    }

    case 'TASK_ERROR_CONTINUE': {
      const updatedTimes = [
        ...state.taskExecutionTimes,
        action.payload.elapsed,
      ];
      const updatedTaskInfos = state.taskInfos.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Failed,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      return {
        ...state,
        taskInfos: updatedTaskInfos,
        taskExecutionTimes: updatedTimes,
        completed: action.payload.index + 1,
      };
    }

    case 'LAST_TASK_ERROR': {
      const updatedTimes = [
        ...state.taskExecutionTimes,
        action.payload.elapsed,
      ];
      const updatedTaskInfos = state.taskInfos.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Failed,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      const totalElapsed = updatedTimes.reduce((sum, time) => sum + time, 0);
      const completion = `${action.payload.summaryText} in ${formatDuration(totalElapsed)}.`;
      return {
        ...state,
        taskInfos: updatedTaskInfos,
        taskExecutionTimes: updatedTimes,
        completed: action.payload.index + 1,
        completionMessage: completion,
      };
    }

    case 'CANCEL_EXECUTION': {
      const updatedTaskInfos = state.taskInfos.map((task, taskIndex) => {
        if (taskIndex < action.payload.completed) {
          return { ...task, status: ExecutionStatus.Success };
        } else if (taskIndex === action.payload.completed) {
          return { ...task, status: ExecutionStatus.Aborted };
        } else {
          return { ...task, status: ExecutionStatus.Cancelled };
        }
      });
      return {
        ...state,
        taskInfos: updatedTaskInfos,
      };
    }

    default:
      return state;
  }
}

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

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
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
  const [localState, dispatch] = useReducer(executeReducer, {
    error: null,
    taskInfos: [],
    message: '',
    completed: 0,
    hasProcessed: false,
    taskExecutionTimes: [],
    completionMessage: null,
    summary: '',
  });

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
    dispatch({ type: 'CANCEL_EXECUTION', payload: { completed } });

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
        // Load user config for placeholder resolution
        const userConfig = loadUserConfig();

        // Format tasks for the execute tool and resolve placeholders
        const taskDescriptions = tasks
          .map((task) => {
            const resolvedAction = replacePlaceholders(task.action, userConfig);
            const params = task.params
              ? ` (params: ${JSON.stringify(task.params)})`
              : '';
            return `- ${resolvedAction}${params}`;
          })
          .join('\n');

        // Call execute tool to get commands
        const result = await svc.processWithTool(taskDescriptions, 'execute');

        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (!mounted) return;

        // Add debug components to timeline if present
        if (result.debug?.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }

        if (!result.commands || result.commands.length === 0) {
          dispatch({
            type: 'PROCESSING_COMPLETE',
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

        // Resolve placeholders in command strings
        const resolvedCommands = result.commands.map((cmd) => {
          const resolved = replacePlaceholders(cmd.command, userConfig);
          validatePlaceholderResolution(resolved, cmd.command);
          return { ...cmd, command: resolved };
        });

        // Set message, summary, and create task infos
        const newMessage = result.message;
        const newSummary = result.summary || '';
        const infos = resolvedCommands.map((cmd, index) => ({
          label: tasks[index]?.action,
          command: cmd,
        }));

        dispatch({
          type: 'COMMANDS_READY',
          payload: {
            message: newMessage,
            summary: newSummary,
            taskInfos: infos,
          },
        });

        // Update state after AI processing
        const finalState: ExecuteState = {
          message: newMessage,
          summary: newSummary,
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
            type: 'PROCESSING_ERROR',
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
      if (index < taskInfos.length - 1) {
        // More tasks to execute
        dispatch({ type: 'TASK_COMPLETE', payload: { index, elapsed } });

        const updatedTimes = [...taskExecutionTimes, elapsed];
        const updatedTaskInfos = taskInfos.map((task, i) =>
          i === index
            ? { ...task, status: ExecutionStatus.Success, elapsed }
            : task
        );

        const finalState: ExecuteState = {
          message,
          summary,
          taskInfos: updatedTaskInfos,
          completed: index + 1,
          taskExecutionTimes: updatedTimes,
          completionMessage: null,
          error: null,
        };
        requestHandlers.onCompleted(finalState);
      } else {
        // All tasks complete
        const summaryText = summary.trim() || 'Execution completed';
        dispatch({
          type: 'ALL_TASKS_COMPLETE',
          payload: { index, elapsed, summaryText },
        });

        const updatedTimes = [...taskExecutionTimes, elapsed];
        const updatedTaskInfos = taskInfos.map((task, i) =>
          i === index
            ? { ...task, status: ExecutionStatus.Success, elapsed }
            : task
        );
        const totalElapsed = updatedTimes.reduce((sum, time) => sum + time, 0);
        const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;

        const finalState: ExecuteState = {
          message,
          summary,
          taskInfos: updatedTaskInfos,
          completed: index + 1,
          taskExecutionTimes: updatedTimes,
          completionMessage: completion,
          error: null,
        };
        requestHandlers.onCompleted(finalState);
        lifecycleHandlers.completeActive();
      }
    },
    [
      taskInfos,
      message,
      lifecycleHandlers,
      taskExecutionTimes,
      summary,
      requestHandlers,
    ]
  );

  const handleTaskError = useCallback(
    (index: number, error: string, elapsed: number) => {
      const task = taskInfos[index];
      const isCritical = task.command.critical !== false; // Default to true

      const updatedTaskInfos = taskInfos.map((task, i) =>
        i === index
          ? { ...task, status: ExecutionStatus.Failed, elapsed }
          : task
      );

      if (isCritical) {
        // Critical failure - stop execution
        dispatch({ type: 'TASK_ERROR_CRITICAL', payload: { index, error } });
        const finalState: ExecuteState = {
          message,
          summary,
          taskInfos: updatedTaskInfos,
          completed: index + 1,
          taskExecutionTimes,
          completionMessage: null,
          error,
        };
        requestHandlers.onCompleted(finalState);
        requestHandlers.onError(error);
      } else {
        // Non-critical failure - continue to next task
        const updatedTimes = [...taskExecutionTimes, elapsed];

        if (index < taskInfos.length - 1) {
          dispatch({
            type: 'TASK_ERROR_CONTINUE',
            payload: { index, elapsed },
          });
          const finalState: ExecuteState = {
            message,
            summary,
            taskInfos: updatedTaskInfos,
            completed: index + 1,
            taskExecutionTimes: updatedTimes,
            completionMessage: null,
            error: null,
          };
          requestHandlers.onCompleted(finalState);
        } else {
          // Last task, complete execution
          const summaryText = summary.trim() || 'Execution completed';
          dispatch({
            type: 'LAST_TASK_ERROR',
            payload: { index, elapsed, summaryText },
          });

          const totalElapsed = updatedTimes.reduce(
            (sum, time) => sum + time,
            0
          );
          const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;

          const finalState: ExecuteState = {
            message,
            summary,
            taskInfos: updatedTaskInfos,
            completed: index + 1,
            taskExecutionTimes: updatedTimes,
            completionMessage: completion,
            error: null,
          };
          requestHandlers.onCompleted(finalState);
          lifecycleHandlers.completeActive();
        }
      }
    },
    [
      taskInfos,
      message,
      requestHandlers,
      lifecycleHandlers,

      taskExecutionTimes,
      summary,
    ]
  );

  const handleTaskAbort = useCallback(
    (_index: number) => {
      // Task was aborted - execution already stopped by Escape handler
      // Just update state, don't call onAborted (already called at Execute level)
      const finalState: ExecuteState = {
        message,
        summary,
        taskInfos,
        completed,
        taskExecutionTimes,
        completionMessage: null,
        error: null,
      };
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
