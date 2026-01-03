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
          ? {
              ...task,
              status: ExecutionStatus.Running,
              startTime: action.payload.startTime,
            }
          : task
      );
      return {
        ...state,
        tasks: updatedTasks,
      };
    }

    case ExecuteActionType.TaskProgress: {
      const updatedTasks = state.tasks.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              elapsed: action.payload.elapsed,
              output: action.payload.output,
            }
          : task
      );
      return {
        ...state,
        tasks: updatedTasks,
      };
    }

    case ExecuteActionType.TaskComplete: {
      const updatedTasks = state.tasks.map((task, i) =>
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
        tasks: updatedTasks,
      };
    }

    case ExecuteActionType.ExecutionComplete: {
      const updatedTasks = state.tasks.map((task, i) =>
        i === action.payload.index
          ? {
              ...task,
              status: ExecutionStatus.Success,
              elapsed: action.payload.elapsed,
            }
          : task
      );
      const totalElapsed = getTotalElapsed(updatedTasks);
      const completion = `${action.payload.summaryText} in ${formatDuration(totalElapsed)}.`;
      return {
        ...state,
        tasks: updatedTasks,
        completionMessage: completion,
      };
    }

    case ExecuteActionType.TaskError: {
      // Mark failed task as Failed, remaining pending tasks as Cancelled
      const updatedTasks = state.tasks.map((task, i) => {
        if (i === action.payload.index) {
          return { ...task, status: ExecutionStatus.Failed, elapsed: 0 };
        } else if (task.status === ExecutionStatus.Pending) {
          return { ...task, status: ExecutionStatus.Cancelled };
        }
        return task;
      });
      return {
        ...state,
        tasks: updatedTasks,
        error: action.payload.error,
      };
    }

    case ExecuteActionType.CancelExecution: {
      // Mark running task as aborted, pending tasks as cancelled
      const updatedTasks = state.tasks.map((task) => {
        if (task.status === ExecutionStatus.Running) {
          return { ...task, status: ExecutionStatus.Aborted };
        } else if (task.status === ExecutionStatus.Pending) {
          return { ...task, status: ExecutionStatus.Cancelled };
        }
        return task;
      });
      return {
        ...state,
        tasks: updatedTasks,
      };
    }

    default:
      return state;
  }
}
