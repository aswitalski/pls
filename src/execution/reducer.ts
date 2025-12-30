import { TaskInfo } from '../types/components.js';
import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import {
  ExecuteAction,
  ExecuteActionType,
  InternalExecuteState,
} from './types.js';

/**
 * Calculate total elapsed time from task infos
 */
function getTotalElapsed(tasks: TaskInfo[]): number {
  return tasks.reduce((sum, task) => sum + task.elapsed, 0);
}

export const initialState: InternalExecuteState = {
  error: null,
  tasks: [],
  message: '',
  completed: 0,
  hasProcessed: false,
  completionMessage: null,
  summary: '',
};

export function executeReducer(
  state: InternalExecuteState,
  action: ExecuteAction
): InternalExecuteState {
  switch (action.type) {
    case ExecuteActionType.ProcessingComplete:
      return {
        ...state,
        message: action.payload.message,
        hasProcessed: true,
      };

    case ExecuteActionType.CommandsReady:
      return {
        ...state,
        message: action.payload.message,
        summary: action.payload.summary,
        tasks: action.payload.tasks,
        completed: 0,
      };

    case ExecuteActionType.ProcessingError:
      return {
        ...state,
        error: action.payload.error,
        hasProcessed: true,
      };

    case ExecuteActionType.TaskComplete: {
      const updatedTaskInfos = state.tasks.map((task, i) =>
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
        tasks: updatedTaskInfos,
        completed: action.payload.index + 1,
      };
    }

    case ExecuteActionType.AllTasksComplete: {
      const updatedTaskInfos = state.tasks.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Success,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      const totalElapsed = getTotalElapsed(updatedTaskInfos);
      const completion = `${action.payload.summaryText} in ${formatDuration(totalElapsed)}.`;
      return {
        ...state,
        tasks: updatedTaskInfos,
        completed: action.payload.index + 1,
        completionMessage: completion,
      };
    }

    case ExecuteActionType.TaskErrorCritical: {
      const updatedTaskInfos = state.tasks.map((task, i) =>
        i === action.payload.index
          ? { ...task, status: ExecutionStatus.Failed, elapsed: 0 }
          : task
      );
      return {
        ...state,
        tasks: updatedTaskInfos,
        error: action.payload.error,
      };
    }

    case ExecuteActionType.TaskErrorContinue: {
      const updatedTaskInfos = state.tasks.map((task, i) =>
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
        tasks: updatedTaskInfos,
        completed: action.payload.index + 1,
      };
    }

    case ExecuteActionType.LastTaskError: {
      const updatedTaskInfos = state.tasks.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Failed,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      const totalElapsed = getTotalElapsed(updatedTaskInfos);
      const completion = `${action.payload.summaryText} in ${formatDuration(totalElapsed)}.`;
      return {
        ...state,
        tasks: updatedTaskInfos,
        completed: action.payload.index + 1,
        completionMessage: completion,
      };
    }

    case ExecuteActionType.CancelExecution: {
      const updatedTaskInfos = state.tasks.map((task, taskIndex) => {
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
        tasks: updatedTaskInfos,
      };
    }

    default:
      return state;
  }
}
