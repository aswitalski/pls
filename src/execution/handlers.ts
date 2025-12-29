import { ExecuteState, TaskInfo } from '../types/components.js';

import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import {
  ExecuteAction,
  ExecuteActionType,
  TaskCompletionContext,
} from './types.js';

export interface TaskCompletionResult {
  action: ExecuteAction;
  finalState: ExecuteState;
  shouldComplete: boolean;
}

export interface TaskErrorResult {
  action: ExecuteAction;
  finalState: ExecuteState;
  shouldComplete: boolean;
}

/**
 * Calculate total elapsed time from task infos
 */
function getTotalElapsed(taskInfos: TaskInfo[]): number {
  return taskInfos.reduce((sum, task) => sum + (task.elapsed ?? 0), 0);
}

/**
 * Handles task completion logic and returns the appropriate action and state.
 */
export function handleTaskCompletion(
  index: number,
  elapsed: number,
  context: TaskCompletionContext
): TaskCompletionResult {
  const { taskInfos, message, summary } = context;
  const updatedTaskInfos = taskInfos.map((task, i) =>
    i === index ? { ...task, status: ExecutionStatus.Success, elapsed } : task
  );

  if (index < taskInfos.length - 1) {
    // More tasks to execute
    return {
      action: {
        type: ExecuteActionType.TaskComplete,
        payload: { index, elapsed },
      },
      finalState: {
        message,
        summary,
        taskInfos: updatedTaskInfos,
        completed: index + 1,
        completionMessage: null,
        error: null,
      },
      shouldComplete: false,
    };
  }

  // All tasks complete
  const summaryText = summary.trim() || 'Execution completed';
  const totalElapsed = getTotalElapsed(updatedTaskInfos);
  const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;

  return {
    action: {
      type: ExecuteActionType.AllTasksComplete,
      payload: { index, elapsed, summaryText },
    },
    finalState: {
      message,
      summary,
      taskInfos: updatedTaskInfos,
      completed: index + 1,
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
  elapsed: number,
  context: TaskCompletionContext
): TaskErrorResult {
  const { taskInfos, message, summary } = context;
  const task = taskInfos[index];
  const isCritical = task.command.critical !== false; // Default to true

  const updatedTaskInfos = taskInfos.map((task, i) =>
    i === index ? { ...task, status: ExecutionStatus.Failed, elapsed } : task
  );

  if (isCritical) {
    // Critical failure - stop execution
    return {
      action: {
        type: ExecuteActionType.TaskErrorCritical,
        payload: { index, error },
      },
      finalState: {
        message,
        summary,
        taskInfos: updatedTaskInfos,
        completed: index + 1,
        completionMessage: null,
        error: null,
      },
      shouldComplete: true,
    };
  }

  // Non-critical failure - continue to next task
  if (index < taskInfos.length - 1) {
    return {
      action: {
        type: ExecuteActionType.TaskErrorContinue,
        payload: { index, elapsed },
      },
      finalState: {
        message,
        summary,
        taskInfos: updatedTaskInfos,
        completed: index + 1,
        completionMessage: null,
        error: null,
      },
      shouldComplete: false,
    };
  }

  // Last task failed (non-critical), complete execution
  // Non-critical failures still show completion message with summary
  const summaryText = summary.trim() || 'Execution completed';
  const totalElapsed = getTotalElapsed(updatedTaskInfos);
  const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;

  return {
    action: {
      type: ExecuteActionType.LastTaskError,
      payload: { index, elapsed, summaryText },
    },
    finalState: {
      message,
      summary,
      taskInfos: updatedTaskInfos,
      completed: index + 1,
      completionMessage: completion,
      error: null,
    },
    shouldComplete: true,
  };
}

/**
 * Builds final state for task abortion.
 */
export function buildAbortedState(
  taskInfos: TaskInfo[],
  message: string,
  summary: string,
  completed: number
): ExecuteState {
  return {
    message,
    summary,
    taskInfos,
    completed,
    completionMessage: null,
    error: null,
  };
}
