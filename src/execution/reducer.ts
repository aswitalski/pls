import { ExecutionStatus } from '../services/shell.js';
import { formatDuration } from '../services/utils.js';

import {
  ExecuteAction,
  ExecuteActionType,
  InternalExecuteState,
} from './types.js';

export const initialState: InternalExecuteState = {
  error: null,
  taskInfos: [],
  message: '',
  completed: 0,
  hasProcessed: false,
  taskExecutionTimes: [],
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
        taskInfos: action.payload.taskInfos,
        completed: 0,
      };

    case ExecuteActionType.ProcessingError:
      return {
        ...state,
        error: action.payload.error,
        hasProcessed: true,
      };

    case ExecuteActionType.TaskComplete: {
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

    case ExecuteActionType.AllTasksComplete: {
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

    case ExecuteActionType.TaskErrorCritical: {
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

    case ExecuteActionType.TaskErrorContinue: {
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

    case ExecuteActionType.LastTaskError: {
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

    case ExecuteActionType.CancelExecution: {
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
