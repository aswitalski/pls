import { ExecuteState, TaskInfo } from '../types/components.js';
import { ExecuteCommand } from '../services/anthropic.js';
import { ComponentDefinition } from '../types/components.js';

export enum ExecuteActionType {
  ProcessingComplete = 'PROCESSING_COMPLETE',
  CommandsReady = 'COMMANDS_READY',
  ProcessingError = 'PROCESSING_ERROR',
  TaskComplete = 'TASK_COMPLETE',
  AllTasksComplete = 'ALL_TASKS_COMPLETE',
  TaskErrorCritical = 'TASK_ERROR_CRITICAL',
  TaskErrorContinue = 'TASK_ERROR_CONTINUE',
  LastTaskError = 'LAST_TASK_ERROR',
  CancelExecution = 'CANCEL_EXECUTION',
}

export type ExecuteAction =
  | {
      type: ExecuteActionType.ProcessingComplete;
      payload: { message: string };
    }
  | {
      type: ExecuteActionType.CommandsReady;
      payload: {
        message: string;
        summary: string;
        taskInfos: TaskInfo[];
      };
    }
  | {
      type: ExecuteActionType.ProcessingError;
      payload: { error: string };
    }
  | {
      type: ExecuteActionType.TaskComplete;
      payload: { index: number; elapsed: number };
    }
  | {
      type: ExecuteActionType.AllTasksComplete;
      payload: { index: number; elapsed: number; summaryText: string };
    }
  | {
      type: ExecuteActionType.TaskErrorCritical;
      payload: { index: number; error: string };
    }
  | {
      type: ExecuteActionType.TaskErrorContinue;
      payload: { index: number; elapsed: number };
    }
  | {
      type: ExecuteActionType.LastTaskError;
      payload: { index: number; elapsed: number; summaryText: string };
    }
  | {
      type: ExecuteActionType.CancelExecution;
      payload: { completed: number };
    };

// Internal state for reducer - extends ExecuteState with hasProcessed
export interface InternalExecuteState extends ExecuteState {
  hasProcessed: boolean;
}

export interface TaskProcessingResult {
  message: string;
  summary: string;
  commands: ExecuteCommand[];
  debug?: ComponentDefinition[];
}

export interface TaskCompletionContext {
  taskInfos: TaskInfo[];
  message: string;
  summary: string;
  taskExecutionTimes: number[];
}
