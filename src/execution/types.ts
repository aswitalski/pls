import { ExecuteState, TaskData, TaskOutput } from '../types/components.js';
import { ExecuteCommand } from '../services/anthropic.js';
import { ComponentDefinition } from '../types/components.js';

export enum ExecuteActionType {
  ProcessingComplete = 'PROCESSING_COMPLETE',
  CommandsReady = 'COMMANDS_READY',
  ProcessingError = 'PROCESSING_ERROR',
  TaskStarted = 'TASK_STARTED',
  TaskProgress = 'TASK_PROGRESS',
  TaskComplete = 'TASK_COMPLETE',
  ExecutionComplete = 'EXECUTION_COMPLETE',
  TaskError = 'TASK_ERROR',
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
        tasks: TaskData[];
      };
    }
  | {
      type: ExecuteActionType.ProcessingError;
      payload: { error: string };
    }
  | {
      type: ExecuteActionType.TaskStarted;
      payload: { index: number; startTime: number };
    }
  | {
      type: ExecuteActionType.TaskProgress;
      payload: { index: number; elapsed: number; output: TaskOutput };
    }
  | {
      type: ExecuteActionType.TaskComplete;
      payload: { index: number; elapsed: number };
    }
  | {
      type: ExecuteActionType.ExecutionComplete;
      payload: { index: number; elapsed: number; summaryText: string };
    }
  | {
      type: ExecuteActionType.TaskError;
      payload: { index: number; error: string };
    }
  | {
      type: ExecuteActionType.CancelExecution;
    };

// Internal state for reducer - extends ExecuteState with hasProcessed
export interface InternalExecuteState extends ExecuteState {
  hasProcessed: boolean;
}

export interface TaskProcessingResult {
  message: string;
  summary: string;
  commands: ExecuteCommand[];
  error?: string;
  debug?: ComponentDefinition[];
}

export interface TaskCompletionContext {
  tasks: TaskData[];
  message: string;
  summary: string;
}
