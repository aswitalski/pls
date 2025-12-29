import { describe, expect, it } from 'vitest';

import { TaskInfo } from '../../src/types/components.js';
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

function createTaskInfo(label: string, critical?: boolean): TaskInfo {
  return {
    label,
    command: {
      description: label,
      command: `run ${label}`,
      critical,
    },
  };
}

function createContext(
  taskInfos: TaskInfo[],
  options: Partial<TaskCompletionContext> = {}
): TaskCompletionContext {
  return {
    taskInfos,
    message: options.message ?? 'Test message',
    summary: options.summary ?? 'Test summary',
    taskExecutionTimes: options.taskExecutionTimes ?? [],
  };
}

describe('Task completion handling', () => {
  describe('handleTaskCompletion', () => {
    it('completes single task and marks shouldComplete true', () => {
      const taskInfos = [createTaskInfo('Task 1')];
      const context = createContext(taskInfos);

      const result = handleTaskCompletion(0, 1000, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.AllTasksComplete);
      expect(result.finalState.taskInfos[0].status).toBe(
        ExecutionStatus.Success
      );
    });

    it('completes intermediate task with more tasks remaining', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const context = createContext(taskInfos);

      const result = handleTaskCompletion(0, 1500, context);

      expect(result.shouldComplete).toBe(false);
      expect(result.action.type).toBe(ExecuteActionType.TaskComplete);
      expect(result.finalState.completed).toBe(1);
    });

    it('updates task status to Success with correct elapsed time', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const context = createContext(taskInfos);

      const result = handleTaskCompletion(0, 2500, context);

      expect(result.finalState.taskInfos[0].status).toBe(
        ExecutionStatus.Success
      );
      expect(result.finalState.taskInfos[0].elapsed).toBe(2500);
      expect(result.finalState.taskInfos[1].status).toBeUndefined();
    });

    it('accumulates execution times correctly', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const context = createContext(taskInfos, {
        taskExecutionTimes: [1000],
      });

      const result = handleTaskCompletion(1, 2000, context);

      expect(result.finalState.taskExecutionTimes).toEqual([1000, 2000]);
    });

    it('generates completion message with formatted duration on last task', () => {
      const taskInfos = [createTaskInfo('Task 1')];
      const context = createContext(taskInfos, {
        summary: 'Build completed',
      });

      const result = handleTaskCompletion(0, 5000, context);

      expect(result.finalState.completionMessage).toBe(
        'Build completed in 5 seconds.'
      );
    });

    it('uses default summary text when summary is empty', () => {
      const taskInfos = [createTaskInfo('Task 1')];
      const context = createContext(taskInfos, {
        summary: '',
      });

      const result = handleTaskCompletion(0, 3000, context);

      expect(result.finalState.completionMessage).toBe(
        'Execution completed in 3 seconds.'
      );
    });

    it('uses default summary text when summary is whitespace only', () => {
      const taskInfos = [createTaskInfo('Task 1')];
      const context = createContext(taskInfos, {
        summary: '   ',
      });

      const result = handleTaskCompletion(0, 2000, context);

      expect(result.finalState.completionMessage).toBe(
        'Execution completed in 2 seconds.'
      );
    });

    it('calculates total elapsed from all task times', () => {
      const taskInfos = [
        createTaskInfo('Task 1'),
        createTaskInfo('Task 2'),
        createTaskInfo('Task 3'),
      ];
      const context = createContext(taskInfos, {
        taskExecutionTimes: [1000, 2000],
        summary: 'Done',
      });

      const result = handleTaskCompletion(2, 3000, context);

      // Total: 1000 + 2000 + 3000 = 6000ms = 6 seconds
      expect(result.finalState.completionMessage).toBe('Done in 6 seconds.');
    });
  });

  describe('handleTaskFailure', () => {
    it('stops execution on critical task failure', () => {
      const taskInfos = [createTaskInfo('Task 1', true)];
      const context = createContext(taskInfos);

      const result = handleTaskFailure(0, 'Build failed', 1000, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.TaskErrorCritical);
      expect(result.finalState.error).toBeNull();
      expect(result.finalState.completionMessage).toBeNull();
    });

    it('continues execution on non-critical task failure', () => {
      const taskInfos = [
        createTaskInfo('Task 1', false),
        createTaskInfo('Task 2'),
      ];
      const context = createContext(taskInfos);

      const result = handleTaskFailure(0, 'Warning: test failed', 500, context);

      expect(result.shouldComplete).toBe(false);
      expect(result.action.type).toBe(ExecuteActionType.TaskErrorContinue);
      expect(result.finalState.error).toBeNull();
    });

    it('defaults to critical when critical field is undefined', () => {
      const taskInfos = [createTaskInfo('Task 1')];
      const context = createContext(taskInfos);

      const result = handleTaskFailure(0, 'Error', 100, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.TaskErrorCritical);
    });

    it('marks task status as Failed with correct elapsed time', () => {
      const taskInfos = [createTaskInfo('Task 1', true)];
      const context = createContext(taskInfos);

      const result = handleTaskFailure(0, 'Error', 1500, context);

      expect(result.finalState.taskInfos[0].status).toBe(
        ExecutionStatus.Failed
      );
      expect(result.finalState.taskInfos[0].elapsed).toBe(1500);
    });

    it('handles last non-critical task failure and completes execution', () => {
      const taskInfos = [createTaskInfo('Task 1', false)];
      const context = createContext(taskInfos, {
        summary: 'Lint check',
      });

      const result = handleTaskFailure(0, 'Warning', 2000, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.LastTaskError);
      expect(result.finalState.completionMessage).toBe(
        'Lint check in 2 seconds.'
      );
    });

    it('generates completion message for last task even on failure', () => {
      const taskInfos = [
        createTaskInfo('Task 1', false),
        createTaskInfo('Task 2', false),
      ];
      const context = createContext(taskInfos, {
        taskExecutionTimes: [1000],
        summary: 'Tests completed',
      });

      const result = handleTaskFailure(1, 'Test warning', 3000, context);

      expect(result.finalState.completionMessage).toBe(
        'Tests completed in 4 seconds.'
      );
    });

    it('accumulates times for non-critical continue case', () => {
      const taskInfos = [
        createTaskInfo('Task 1', false),
        createTaskInfo('Task 2'),
      ];
      const context = createContext(taskInfos, {
        taskExecutionTimes: [500],
      });

      const result = handleTaskFailure(0, 'Warning', 750, context);

      expect(result.finalState.taskExecutionTimes).toEqual([500, 750]);
    });
  });

  describe('buildAbortedState', () => {
    it('returns state with correct taskInfos array', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];

      const result = buildAbortedState(
        taskInfos,
        'Message',
        'Summary',
        1,
        [1000]
      );

      expect(result.taskInfos).toEqual(taskInfos);
    });

    it('preserves message and summary', () => {
      const taskInfos = [createTaskInfo('Task')];

      const result = buildAbortedState(
        taskInfos,
        'Build cancelled',
        'Partial build',
        0,
        []
      );

      expect(result.message).toBe('Build cancelled');
      expect(result.summary).toBe('Partial build');
    });

    it('sets completionMessage to null', () => {
      const taskInfos = [createTaskInfo('Task')];

      const result = buildAbortedState(taskInfos, 'Msg', 'Sum', 0, []);

      expect(result.completionMessage).toBeNull();
    });

    it('sets error to null', () => {
      const taskInfos = [createTaskInfo('Task')];

      const result = buildAbortedState(taskInfos, 'Msg', 'Sum', 0, []);

      expect(result.error).toBeNull();
    });

    it('preserves completed count and execution times', () => {
      const taskInfos = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];

      const result = buildAbortedState(
        taskInfos,
        'Msg',
        'Sum',
        1,
        [1500, 2500]
      );

      expect(result.completed).toBe(1);
      expect(result.taskExecutionTimes).toEqual([1500, 2500]);
    });
  });
});
