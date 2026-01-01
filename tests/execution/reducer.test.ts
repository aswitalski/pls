import { describe, expect, it } from 'vitest';

import { TaskData } from '../../src/types/components.js';
import { ExecutionStatus } from '../../src/services/shell.js';

import { executeReducer, initialState } from '../../src/execution/reducer.js';
import {
  ExecuteAction,
  ExecuteActionType,
  InternalExecuteState,
} from '../../src/execution/types.js';

function createTaskData(
  label: string,
  elapsed: number = 0,
  status: ExecutionStatus = ExecutionStatus.Pending
): TaskData {
  return {
    label,
    command: {
      description: label,
      command: `run ${label}`,
    },
    status,
    elapsed,
    output: null,
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
      expect(initialState.tasks).toEqual([]);
      expect(initialState.message).toBe('');
      expect(initialState.hasProcessed).toBe(false);
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
        tasks: [createTaskData('Task')],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.ProcessingComplete,
        payload: { message: 'Done' },
      };

      const result = executeReducer(state, action);

      expect(result.tasks).toEqual(state.tasks);
    });
  });

  describe('CommandsReady action', () => {
    it('sets message, summary, and tasks', () => {
      const tasks = [createTaskData('Task 1'), createTaskData('Task 2')];
      const action: ExecuteAction = {
        type: ExecuteActionType.CommandsReady,
        payload: {
          message: 'Commands ready',
          summary: 'Build and deploy',
          tasks,
        },
      };

      const result = executeReducer(initialState, action);

      expect(result.message).toBe('Commands ready');
      expect(result.summary).toBe('Build and deploy');
      expect(result.tasks).toEqual(tasks);
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
      const tasks = [createTaskData('Task 1'), createTaskData('Task 2')];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 1000 },
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].status).toBe(ExecutionStatus.Success);
      expect(result.tasks[1].status).toBe(ExecutionStatus.Pending);
    });

    it('updates task elapsed time', () => {
      const tasks = [createTaskData('Task 1')];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 2500 },
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].elapsed).toBe(2500);
    });

    it('stores elapsed time on task info', () => {
      const state = createBaseState({
        tasks: [createTaskData('Task', 1000)],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskComplete,
        payload: { index: 0, elapsed: 3000 },
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].elapsed).toBe(3000);
    });
  });

  describe('ExecutionComplete action', () => {
    it('updates last task status to Success', () => {
      const tasks = [createTaskData('Task 1'), createTaskData('Task 2')];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.ExecutionComplete,
        payload: { index: 1, elapsed: 2000, summaryText: 'Done' },
      };

      const result = executeReducer(state, action);

      expect(result.tasks[1].status).toBe(ExecutionStatus.Success);
      expect(result.tasks[1].elapsed).toBe(2000);
    });

    it('generates completionMessage with total duration', () => {
      const state = createBaseState({
        tasks: [createTaskData('Task', 2000)],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.ExecutionComplete,
        payload: { index: 0, elapsed: 3000, summaryText: 'Build successful' },
      };

      const result = executeReducer(state, action);

      // elapsed is set to 3000, so total = 3000ms = 3 seconds
      expect(result.completionMessage).toBe('Build successful in 3 seconds.');
    });
  });

  describe('TaskError action', () => {
    it('marks task as Failed', () => {
      const tasks = [createTaskData('Task')];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskError,
        payload: { index: 0, error: 'Task error' },
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].status).toBe(ExecutionStatus.Failed);
    });

    it('sets elapsed to 0', () => {
      const tasks = [createTaskData('Task')];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskError,
        payload: { index: 0, error: 'Error' },
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].elapsed).toBe(0);
    });

    it('sets error in state', () => {
      const state = createBaseState({
        tasks: [createTaskData('Task')],
      });
      const action: ExecuteAction = {
        type: ExecuteActionType.TaskError,
        payload: { index: 0, error: 'Build failed: missing dependency' },
      };

      const result = executeReducer(state, action);

      expect(result.error).toBe('Build failed: missing dependency');
    });
  });

  describe('CancelExecution action', () => {
    it('preserves completed tasks as Success', () => {
      const tasks = [
        createTaskData('Task 1', 1000, ExecutionStatus.Success),
        createTaskData('Task 2', 0, ExecutionStatus.Running),
        createTaskData('Task 3'),
      ];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].status).toBe(ExecutionStatus.Success);
    });

    it('marks running task as Aborted', () => {
      const tasks = [
        createTaskData('Task 1', 1000, ExecutionStatus.Success),
        createTaskData('Task 2', 0, ExecutionStatus.Running),
        createTaskData('Task 3'),
      ];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
      };

      const result = executeReducer(state, action);

      expect(result.tasks[1].status).toBe(ExecutionStatus.Aborted);
    });

    it('marks pending tasks as Cancelled', () => {
      const tasks = [
        createTaskData('Task 1', 1000, ExecutionStatus.Success),
        createTaskData('Task 2', 0, ExecutionStatus.Running),
        createTaskData('Task 3'),
        createTaskData('Task 4'),
      ];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].status).toBe(ExecutionStatus.Success);
      expect(result.tasks[1].status).toBe(ExecutionStatus.Aborted);
      expect(result.tasks[2].status).toBe(ExecutionStatus.Cancelled);
      expect(result.tasks[3].status).toBe(ExecutionStatus.Cancelled);
    });

    it('handles cancellation at first task', () => {
      const tasks = [
        createTaskData('Task 1', 0, ExecutionStatus.Running),
        createTaskData('Task 2'),
      ];
      const state = createBaseState({ tasks });
      const action: ExecuteAction = {
        type: ExecuteActionType.CancelExecution,
      };

      const result = executeReducer(state, action);

      expect(result.tasks[0].status).toBe(ExecutionStatus.Aborted);
      expect(result.tasks[1].status).toBe(ExecutionStatus.Cancelled);
    });
  });

  describe('Unknown action', () => {
    it('returns state unchanged', () => {
      const state = createBaseState({
        message: 'Original',
      });
      const action = { type: 'UNKNOWN_ACTION', payload: {} } as never;

      const result = executeReducer(state, action);

      expect(result).toEqual(state);
    });
  });
});
