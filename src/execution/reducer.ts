import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import {
  ExecuteAction,
  ExecuteActionType,
  InternalExecuteState,
} from './types.js';
import { getTotalElapsed } from './utils.js';

export const initialState: InternalExecuteState = {
  error: null,
  tasks: [],
  message: '',
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
      };

    case ExecuteActionType.ProcessingError:
      return {
        ...state,
        error: action.payload.error,
        hasProcessed: true,
      };

    case ExecuteActionType.TaskStarted: {
      const updatedTasks = state.tasks.map((task, i) =>
        i === action.payload.index
          ? { ...task, status: ExecutionStatus.Running }
          : task
      );
      return {
        ...state,
        tasks: updatedTasks,
      };
    }

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
        completionMessage: completion,
      };
    }

    case ExecuteActionType.CancelExecution: {
      // Mark running task as aborted, pending tasks as cancelled
      const updatedTaskInfos = state.tasks.map((task) => {
        if (task.status === ExecutionStatus.Running) {
          return { ...task, status: ExecutionStatus.Aborted };
        } else if (task.status === ExecutionStatus.Pending) {
          return { ...task, status: ExecutionStatus.Cancelled };
        }
        return task;
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
