import { ExecuteState, TaskData } from '../types/components.js';

import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import {
  ExecuteAction,
  ExecuteActionType,
  TaskCompletionContext,
} from './types.js';
import { getTotalElapsed } from './utils.js';

export interface TaskCompletionResult {
  action: ExecuteAction;
  finalState: ExecuteState;
  shouldComplete: boolean;
}

export interface TaskErrorResult {
  action: ExecuteAction;
  finalState: ExecuteState;
}

/**
 * Handles task completion logic and returns the appropriate action and state.
 */
export function handleTaskCompletion(
  index: number,
  elapsed: number,
  context: TaskCompletionContext
): TaskCompletionResult {
  const { tasks, message, summary } = context;
  const updatedTasks = tasks.map((task, i) =>
    i === index ? { ...task, status: ExecutionStatus.Success, elapsed } : task
  );

  if (index < tasks.length - 1) {
    // More tasks to execute
    return {
      action: {
        type: ExecuteActionType.TaskComplete,
        payload: { index, elapsed },
      },
      finalState: {
        message,
        summary,
        tasks: updatedTasks,
        completionMessage: null,
        error: null,
      },
      shouldComplete: false,
    };
  }

  // All tasks complete
  const summaryText = summary.trim() || 'Execution completed';
  const totalElapsed = getTotalElapsed(updatedTasks);
  const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;

  return {
    action: {
      type: ExecuteActionType.ExecutionComplete,
      payload: { index, elapsed, summaryText },
    },
    finalState: {
      message,
      summary,
      tasks: updatedTasks,
      completionMessage: completion,
      error: null,
    },
    shouldComplete: true,
  };
}

/**
 * Handles task error logic and returns the appropriate action and state.
 */
export function handleTaskFailure(
  index: number,
  error: string,
  context: TaskCompletionContext
): TaskErrorResult {
  const { tasks, message, summary } = context;

  const updatedTasks = tasks.map((task, i) => {
    if (i === index) {
      return { ...task, status: ExecutionStatus.Failed, elapsed: 0 };
    } else if (i > index && task.status === ExecutionStatus.Pending) {
      return { ...task, status: ExecutionStatus.Cancelled };
    }
    return task;
  });

  return {
    action: {
      type: ExecuteActionType.TaskError,
      payload: { index, error },
    },
    finalState: {
      message,
      summary,
      tasks: updatedTasks,
      completionMessage: null,
      error: null,
    },
  };
}

/**
 * Builds final state for task abortion.
 */
export function buildAbortedState(
  tasks: TaskData[],
  message: string,
  summary: string
): ExecuteState {
  return {
    message,
    summary,
    tasks,
    completionMessage: null,
    error: null,
  };
}
