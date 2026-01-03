import { describe, expect, it } from 'vitest';

import { TaskData } from '../../src/types/components.js';
import { ExecutionStatus } from '../../src/services/shell.js';

import {
  buildAbortedState,
  handleTaskCompletion,
  handleTaskFailure,
} from '../../src/execution/handlers.js';
import {
  ExecuteActionType,
  TaskCompletionContext,
} from '../../src/execution/types.js';

function createTaskData(label: string, elapsed: number = 0): TaskData {
  return {
    label,
    command: {
      description: label,
      command: `run ${label}`,
    },
    status: ExecutionStatus.Pending,
    elapsed,
    output: null,
  };
}

function createContext(
  tasks: TaskData[],
  options: Partial<TaskCompletionContext> = {}
): TaskCompletionContext {
  return {
    tasks,
    message: options.message ?? 'Test message',
    summary: options.summary ?? 'Test summary',
  };
}

describe('Task completion handling', () => {
  describe('handleTaskCompletion', () => {
    it('completes single task and marks shouldComplete true', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(0, 1000, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.ExecutionComplete);
      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Success);
    });

    it('completes intermediate task with more tasks remaining', () => {
      const tasks = [createTaskData('Task 1'), createTaskData('Task 2')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(0, 1500, context);

      expect(result.shouldComplete).toBe(false);
      expect(result.action.type).toBe(ExecuteActionType.TaskComplete);
    });

    it('updates task status to Success with correct elapsed time', () => {
      const tasks = [createTaskData('Task 1'), createTaskData('Task 2')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(0, 2500, context);

      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Success);
      expect(result.finalState.tasks[0].elapsed).toBe(2500);
      expect(result.finalState.tasks[1].status).toBe(ExecutionStatus.Pending);
    });

    it('stores elapsed time on task info', () => {
      const tasks = [createTaskData('Task 1', 1000), createTaskData('Task 2')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(1, 2000, context);

      expect(result.finalState.tasks[0].elapsed).toBe(1000);
      expect(result.finalState.tasks[1].elapsed).toBe(2000);
    });

    it('generates completion message with formatted duration on last task', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks, {
        summary: 'Build completed',
      });

      const result = handleTaskCompletion(0, 5000, context);

      expect(result.finalState.completionMessage).toBe(
        'Build completed in 5 seconds.'
      );
    });

    it('uses default summary text when summary is empty', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks, {
        summary: '',
      });

      const result = handleTaskCompletion(0, 3000, context);

      expect(result.finalState.completionMessage).toBe(
        'Execution completed in 3 seconds.'
      );
    });

    it('uses default summary text when summary is whitespace only', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks, {
        summary: '   ',
      });

      const result = handleTaskCompletion(0, 2000, context);

      expect(result.finalState.completionMessage).toBe(
        'Execution completed in 2 seconds.'
      );
    });

    it('calculates total elapsed from all task times', () => {
      const tasks = [
        createTaskData('Task 1', 1000),
        createTaskData('Task 2', 2000),
        createTaskData('Task 3'),
      ];
      const context = createContext(tasks, {
        summary: 'Done',
      });

      const result = handleTaskCompletion(2, 3000, context);

      // Total: 1000 + 2000 + 3000 = 6000ms = 6 seconds
      expect(result.finalState.completionMessage).toBe('Done in 6 seconds.');
    });
  });

  describe('handleTaskFailure', () => {
    it('returns TaskError action', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Build failed', context);

      expect(result.action.type).toBe(ExecuteActionType.TaskError);
    });

    it('includes error message in action payload', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Build failed', context);

      expect(result.action.type).toBe(ExecuteActionType.TaskError);
      if (result.action.type === ExecuteActionType.TaskError) {
        expect(result.action.payload).toEqual({
          index: 0,
          error: 'Build failed',
        });
      }
    });

    it('marks task status as Failed', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Error', context);

      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Failed);
    });

    it('sets elapsed to 0 on failed task', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Error', context);

      expect(result.finalState.tasks[0].elapsed).toBe(0);
    });

    it('preserves message and summary in final state', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks, {
        message: 'Running build',
        summary: 'Build completed',
      });

      const result = handleTaskFailure(0, 'Error', context);

      expect(result.finalState.message).toBe('Running build');
      expect(result.finalState.summary).toBe('Build completed');
    });

    it('sets completionMessage and error to null', () => {
      const tasks = [createTaskData('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Error', context);

      expect(result.finalState.completionMessage).toBeNull();
      expect(result.finalState.error).toBeNull();
    });

    it('cancels remaining pending tasks when a task fails', () => {
      const tasks = [
        createTaskData('Task 1'),
        createTaskData('Task 2'),
        createTaskData('Task 3'),
      ];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Build failed', context);

      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Failed);
      expect(result.finalState.tasks[1].status).toBe(ExecutionStatus.Cancelled);
      expect(result.finalState.tasks[2].status).toBe(ExecutionStatus.Cancelled);
    });

    it('preserves completed tasks when a later task fails', () => {
      const tasks = [
        { ...createTaskData('Task 1'), status: ExecutionStatus.Success },
        createTaskData('Task 2'),
        createTaskData('Task 3'),
      ];
      const context = createContext(tasks);

      const result = handleTaskFailure(1, 'Test failed', context);

      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Success);
      expect(result.finalState.tasks[1].status).toBe(ExecutionStatus.Failed);
      expect(result.finalState.tasks[2].status).toBe(ExecutionStatus.Cancelled);
    });
  });

  describe('buildAbortedState', () => {
    it('returns state with correct tasks array', () => {
      const tasks = [createTaskData('Task 1'), createTaskData('Task 2')];

      const result = buildAbortedState(tasks, 'Message', 'Summary');

      expect(result.tasks).toEqual(tasks);
    });

    it('preserves message and summary', () => {
      const tasks = [createTaskData('Task')];

      const result = buildAbortedState(
        tasks,
        'Build cancelled',
        'Partial build'
      );

      expect(result.message).toBe('Build cancelled');
      expect(result.summary).toBe('Partial build');
    });

    it('sets completionMessage to null', () => {
      const tasks = [createTaskData('Task')];

      const result = buildAbortedState(tasks, 'Msg', 'Sum');

      expect(result.completionMessage).toBeNull();
    });

    it('sets error to null', () => {
      const tasks = [createTaskData('Task')];

      const result = buildAbortedState(tasks, 'Msg', 'Sum');

      expect(result.error).toBeNull();
    });
  });
});
