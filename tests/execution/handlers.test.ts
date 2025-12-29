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

function createTaskInfo(
  label: string,
  critical?: boolean,
  elapsed?: number
): TaskInfo {
  return {
    label,
    command: {
      description: label,
      command: `run ${label}`,
      critical,
    },
    elapsed,
  };
}

function createContext(
  tasks: TaskInfo[],
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
      const tasks = [createTaskInfo('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(0, 1000, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.AllTasksComplete);
      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Success);
    });

    it('completes intermediate task with more tasks remaining', () => {
      const tasks = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(0, 1500, context);

      expect(result.shouldComplete).toBe(false);
      expect(result.action.type).toBe(ExecuteActionType.TaskComplete);
      expect(result.finalState.completed).toBe(1);
    });

    it('updates task status to Success with correct elapsed time', () => {
      const tasks = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];
      const context = createContext(tasks);

      const result = handleTaskCompletion(0, 2500, context);

      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Success);
      expect(result.finalState.tasks[0].elapsed).toBe(2500);
      expect(result.finalState.tasks[1].status).toBeUndefined();
    });

    it('stores elapsed time on task info', () => {
      const tasks = [
        createTaskInfo('Task 1', undefined, 1000),
        createTaskInfo('Task 2'),
      ];
      const context = createContext(tasks);

      const result = handleTaskCompletion(1, 2000, context);

      expect(result.finalState.tasks[0].elapsed).toBe(1000);
      expect(result.finalState.tasks[1].elapsed).toBe(2000);
    });

    it('generates completion message with formatted duration on last task', () => {
      const tasks = [createTaskInfo('Task 1')];
      const context = createContext(tasks, {
        summary: 'Build completed',
      });

      const result = handleTaskCompletion(0, 5000, context);

      expect(result.finalState.completionMessage).toBe(
        'Build completed in 5 seconds.'
      );
    });

    it('uses default summary text when summary is empty', () => {
      const tasks = [createTaskInfo('Task 1')];
      const context = createContext(tasks, {
        summary: '',
      });

      const result = handleTaskCompletion(0, 3000, context);

      expect(result.finalState.completionMessage).toBe(
        'Execution completed in 3 seconds.'
      );
    });

    it('uses default summary text when summary is whitespace only', () => {
      const tasks = [createTaskInfo('Task 1')];
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
        createTaskInfo('Task 1', undefined, 1000),
        createTaskInfo('Task 2', undefined, 2000),
        createTaskInfo('Task 3'),
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
    it('stops execution on critical task failure', () => {
      const tasks = [createTaskInfo('Task 1', true)];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Build failed', 1000, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.TaskErrorCritical);
      expect(result.finalState.error).toBeNull();
      expect(result.finalState.completionMessage).toBeNull();
    });

    it('continues execution on non-critical task failure', () => {
      const tasks = [createTaskInfo('Task 1', false), createTaskInfo('Task 2')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Warning: test failed', 500, context);

      expect(result.shouldComplete).toBe(false);
      expect(result.action.type).toBe(ExecuteActionType.TaskErrorContinue);
      expect(result.finalState.error).toBeNull();
    });

    it('defaults to critical when critical field is undefined', () => {
      const tasks = [createTaskInfo('Task 1')];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Error', 100, context);

      expect(result.shouldComplete).toBe(true);
      expect(result.action.type).toBe(ExecuteActionType.TaskErrorCritical);
    });

    it('marks task status as Failed with correct elapsed time', () => {
      const tasks = [createTaskInfo('Task 1', true)];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Error', 1500, context);

      expect(result.finalState.tasks[0].status).toBe(ExecutionStatus.Failed);
      expect(result.finalState.tasks[0].elapsed).toBe(1500);
    });

    it('handles last non-critical task failure and completes execution', () => {
      const tasks = [createTaskInfo('Task 1', false)];
      const context = createContext(tasks, {
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
      const tasks = [
        createTaskInfo('Task 1', false, 1000),
        createTaskInfo('Task 2', false),
      ];
      const context = createContext(tasks, {
        summary: 'Tests completed',
      });

      const result = handleTaskFailure(1, 'Test warning', 3000, context);

      expect(result.finalState.completionMessage).toBe(
        'Tests completed in 4 seconds.'
      );
    });

    it('stores elapsed time on failed task', () => {
      const tasks = [
        createTaskInfo('Task 1', false, 500),
        createTaskInfo('Task 2'),
      ];
      const context = createContext(tasks);

      const result = handleTaskFailure(0, 'Warning', 750, context);

      expect(result.finalState.tasks[0].elapsed).toBe(750);
    });
  });

  describe('buildAbortedState', () => {
    it('returns state with correct tasks array', () => {
      const tasks = [createTaskInfo('Task 1'), createTaskInfo('Task 2')];

      const result = buildAbortedState(tasks, 'Message', 'Summary', 1);

      expect(result.tasks).toEqual(tasks);
    });

    it('preserves message and summary', () => {
      const tasks = [createTaskInfo('Task')];

      const result = buildAbortedState(
        tasks,
        'Build cancelled',
        'Partial build',
        0
      );

      expect(result.message).toBe('Build cancelled');
      expect(result.summary).toBe('Partial build');
    });

    it('sets completionMessage to null', () => {
      const tasks = [createTaskInfo('Task')];

      const result = buildAbortedState(tasks, 'Msg', 'Sum', 0);

      expect(result.completionMessage).toBeNull();
    });

    it('sets error to null', () => {
      const tasks = [createTaskInfo('Task')];

      const result = buildAbortedState(tasks, 'Msg', 'Sum', 0);

      expect(result.error).toBeNull();
    });

    it('preserves completed count', () => {
      const tasks = [
        createTaskInfo('Task 1', undefined, 1500),
        createTaskInfo('Task 2', undefined, 2500),
      ];

      const result = buildAbortedState(tasks, 'Msg', 'Sum', 1);

      expect(result.completed).toBe(1);
    });
  });
});
