import { describe, expect, it } from 'vitest';

import { TaskInfo } from '../../src/types/components.js';
import { ExecutionStatus } from '../../src/services/shell.js';

import { executeReducer, initialState } from '../../src/execution/reducer.js';
import {
  ExecuteAction,
  ExecuteActionType,
  InternalExecuteState,
} from '../../src/execution/types.js';

function createTaskInfo(label: string): TaskInfo {
  return {
    label,
    command: {
      description: label,
      command: `run ${label}`,
    },
  };
}

function createBaseState(
  overrides: Partial<InternalExecuteState> = {}
): InternalExecuteState {
  return {
    ...initialState,
    ...overrides,
  };
}

describe('Execution reducer', () => {
  describe('Initial state', () => {
    it('has correct default values', () => {
      expect(initialState.error).toBeNull();
      expect(initialState.taskInfos).toEqual([]);
      expect(initialState.message).toBe('');
      expect(initialState.completed).toBe(0);
      expect(initialState.hasProcessed).toBe(false);
      expect(initialState.taskExecutionTimes).toEqual([]);
      expect(initialState.completionMessage).toBeNull();
      expect(initialState.summary).toBe('');
    });
  });

  describe('ProcessingComplete action', () => {
    it('sets message from payload', () => {
      const action: ExecuteAction = {
        type: ExecuteActionType.ProcessingComplete,
        payload: { message: 'Processing done' },
      };

      const result = executeReducer(initialState, action);

      expect(result.message).toBe('Processing done');
    });

    it('sets hasProcessed to true', () => {
      const action: ExecuteAction = {
        type: ExecuteActionType.ProcessingComplete,
        payload: { message: 'Done' },
      };

      const result = executeReducer(initialState, action);

      expect(result.hasProcessed).toBe(true);
    });

    it('preserves other state properties', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        completed: 1,
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.ProcessingComplete,
        payload: { message: 'Done' },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos).toEqual(state.taskInfos);
      expect(result.completed).toBe(1);
    });
  });

  describe('CommandsReady action', () => {
    it('sets message, summary, and taskInfos', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const action: ExecuteAction = {
        type: ExecuteActionType.CommandsReady,
        payload: {
          message: 'Commands ready',
          summary: 'Build and deploy',
          taskInfos,
        },
      };

      const result = executeReducer(initialState, action);

      expect(result.message).toBe('Commands ready');
      expect(result.summary).toBe('Build and deploy');
      expect(result.taskInfos).toEqual(taskInfos);
    });

    it('resets completed to 0', () => {
      const state = createBaseState({ completed: 5 });
      const action: ExecuteAction = {
        type: ExecuteActionType.CommandsReady,
        payload: {
          message: 'Ready',
          summary: '',
          taskInfos: [],
        },
      };

      const result = executeReducer(state, action);

      expect(result.completed).toBe(0);
    });
  });

  describe('ProcessingError action', () => {
    it('sets error from payload', () => {
      const action: ExecuteAction = {
        type: ExecuteActionType.ProcessingError,
        payload: { error: 'Failed to process tasks' },
      };

      const result = executeReducer(initialState, action);

      expect(result.error).toBe('Failed to process tasks');
    });

    it('sets hasProcessed to true', () => {
      const action: ExecuteAction = {
        type: ExecuteActionType.ProcessingError,
        payload: { error: 'Error' },
      };

      const result = executeReducer(initialState, action);

      expect(result.hasProcessed).toBe(true);
    });
  });

  describe('TaskComplete action', () => {
    it('updates specific task status to Success', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 1000 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Success);
      expect(result.taskInfos[1].status).toBeUndefined();
    });

    it('updates task elapsed time', () => {
      const taskInfos = [createTaskInfo('Task 1')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 2500 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].elapsed).toBe(2500);
    });

    it('appends elapsed to taskExecutionTimes array', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        taskExecutionTimes: [1000, 2000],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 3000 },
      };

      const result = executeReducer(state, action);

      expect(result.taskExecutionTimes).toEqual([1000, 2000, 3000]);
    });

    it('increments completed count', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task 1'), createTaskInfo('Task 2')],
        completed: 0,
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 500 },
      };

      const result = executeReducer(state, action);

      expect(result.completed).toBe(1);
    });
  });

  describe('AllTasksComplete action', () => {
    it('updates last task status to Success', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.AllTasksComplete,
        payload: { index: 1, elapsed: 2000, summaryText: 'Done' },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[1].status).toBe(ExecutionStatus.Success);
      expect(result.taskInfos[1].elapsed).toBe(2000);
    });

    it('generates completionMessage with total duration', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        taskExecutionTimes: [2000],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.AllTasksComplete,
        payload: { index: 0, elapsed: 3000, summaryText: 'Build successful' },
      };

      const result = executeReducer(state, action);

      // 2000 + 3000 = 5000ms = 5 seconds
      expect(result.completionMessage).toBe('Build successful in 5 seconds.');
    });

    it('increments completed count', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        completed: 0,
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.AllTasksComplete,
        payload: { index: 0, elapsed: 1000, summaryText: 'Done' },
      };

      const result = executeReducer(state, action);

      expect(result.completed).toBe(1);
    });
  });

  describe('TaskErrorCritical action', () => {
    it('marks task as Failed', () => {
      const taskInfos = [createTaskInfo('Task')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskErrorCritical,
        payload: { index: 0, error: 'Critical error' },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Failed);
    });

    it('sets elapsed to 0', () => {
      const taskInfos = [createTaskInfo('Task')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskErrorCritical,
        payload: { index: 0, error: 'Error' },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].elapsed).toBe(0);
    });

    it('sets error in state', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskErrorCritical,
        payload: { index: 0, error: 'Build failed: missing dependency' },
      };

      const result = executeReducer(state, action);

      expect(result.error).toBe('Build failed: missing dependency');
    });
  });

  describe('TaskErrorContinue action', () => {
    it('marks task as Failed with elapsed time', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskErrorContinue,
        payload: { index: 0, elapsed: 1500 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Failed);
      expect(result.taskInfos[0].elapsed).toBe(1500);
    });

    it('increments completed count', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task 1'), createTaskInfo('Task 2')],
        completed: 0,
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskErrorContinue,
        payload: { index: 0, elapsed: 500 },
      };

      const result = executeReducer(state, action);

      expect(result.completed).toBe(1);
    });

    it('appends elapsed to times array', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        taskExecutionTimes: [1000],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskErrorContinue,
        payload: { index: 0, elapsed: 2000 },
      };

      const result = executeReducer(state, action);

      expect(result.taskExecutionTimes).toEqual([1000, 2000]);
    });
  });

  describe('LastTaskError action', () => {
    it('marks task as Failed', () => {
      const taskInfos = [createTaskInfo('Task')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.LastTaskError,
        payload: { index: 0, elapsed: 1000, summaryText: 'Finished' },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Failed);
      expect(result.taskInfos[0].elapsed).toBe(1000);
    });

    it('generates completionMessage', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        taskExecutionTimes: [2000],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.LastTaskError,
        payload: { index: 0, elapsed: 1000, summaryText: 'Lint check' },
      };

      const result = executeReducer(state, action);

      expect(result.completionMessage).toBe('Lint check in 3 seconds.');
    });

    it('increments completed', () => {
      const state = createBaseState({
        taskInfos: [createTaskInfo('Task')],
        completed: 0,
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.LastTaskError,
        payload: { index: 0, elapsed: 500, summaryText: 'Done' },
      };

      const result = executeReducer(state, action);

      expect(result.completed).toBe(1);
    });
  });

  describe('CancelExecution action', () => {
    it('marks completed tasks as Success', () => {
      const taskInfos = [
        createTaskInfo('Task 1'),
        createTaskInfo('Task 2'),
        createTaskInfo('Task 3'),
      ];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
        payload: { completed: 1 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Success);
    });

    it('marks current task as Aborted', () => {
      const taskInfos = [
        createTaskInfo('Task 1'),
        createTaskInfo('Task 2'),
        createTaskInfo('Task 3'),
      ];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
        payload: { completed: 1 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[1].status).toBe(ExecutionStatus.Aborted);
    });

    it('marks remaining tasks as Cancelled', () => {
      const taskInfos = [
        createTaskInfo('Task 1'),
        createTaskInfo('Task 2'),
        createTaskInfo('Task 3'),
        createTaskInfo('Task 4'),
      ];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
        payload: { completed: 1 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Success);
      expect(result.taskInfos[1].status).toBe(ExecutionStatus.Aborted);
      expect(result.taskInfos[2].status).toBe(ExecutionStatus.Cancelled);
      expect(result.taskInfos[3].status).toBe(ExecutionStatus.Cancelled);
    });

    it('handles cancellation at first task', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const state = createBaseState({ taskInfos });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
        payload: { completed: 0 },
      };

      const result = executeReducer(state, action);

      expect(result.taskInfos[0].status).toBe(ExecutionStatus.Aborted);
      expect(result.taskInfos[1].status).toBe(ExecutionStatus.Cancelled);
    });
  });

  describe('Unknown action', () => {
    it('returns state unchanged', () => {
      const state = createBaseState({
        message: 'Original',
        completed: 5,
      });
      const action = { type: 'UNKNOWN_ACTION', payload: {} } as never;

      const result = executeReducer(state, action);

      expect(result).toEqual(state);
    });
  });
});
