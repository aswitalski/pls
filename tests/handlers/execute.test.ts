import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  FeedbackProps,
  MessageProps,
} from '../../src/types/components.js';
import { HandlerOperations, SetQueue } from '../../src/types/handlers.js';
import { ComponentName, FeedbackType } from '../../src/types/types.js';

import { createExecuteHandlers } from '../../src/handlers/execute.js';
import { CommandOutput, ExecutionResult } from '../../src/services/shell.js';

// Mock exitApp to prevent actual process exit
vi.mock('../../src/services/process.js', () => ({
  exitApp: vi.fn(),
}));

describe('Execute handlers', () => {
  let ops: HandlerOperations;
  let addToTimelineMock: ReturnType<typeof vi.fn>;
  let setQueueMock: ReturnType<typeof vi.fn>;
  let handleAbortedMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addToTimelineMock = vi.fn();
    setQueueMock = vi.fn(
      (updater: (queue: ComponentDefinition[]) => ComponentDefinition[]) => {
        return updater;
      }
    );
    handleAbortedMock = vi.fn();
    ops = {
      addToTimeline: addToTimelineMock as (
        ...items: ComponentDefinition[]
      ) => void,
      setQueue: setQueueMock as unknown as SetQueue,
      service: null,
    };
  });

  const getQueueUpdater = () =>
    setQueueMock.mock.calls[0][0] as (
      queue: ComponentDefinition[]
    ) => ComponentDefinition[];
  const getTimelineArgs = () =>
    addToTimelineMock.mock.calls[0] as ComponentDefinition[];

  describe('Execute error handler', () => {
    it('marks Execute component as done and adds failed feedback', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      handlers.onError('Network error');

      expect(setQueueMock).toHaveBeenCalled();
      const queueUpdater = getQueueUpdater();
      queueUpdater(mockQueue);

      expect(addToTimelineMock).toHaveBeenCalledTimes(1);
      const args = getTimelineArgs();
      const markedExecute = args[0];
      const feedback = args[1];

      expect(markedExecute.name).toBe(ComponentName.Execute);
      expect('state' in markedExecute && markedExecute.state.done).toBe(true);

      expect(feedback.name).toBe(ComponentName.Feedback);
      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Failed);
      expect(feedbackProps.message).toBe('Network error');
    });

    it('returns empty queue after processing', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      handlers.onError('Error');

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater(mockQueue);

      expect(result).toEqual([]);
    });

    it('handles empty queue gracefully', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      handlers.onError('Error');

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([]);

      expect(result).toEqual([]);
      expect(addToTimelineMock).not.toHaveBeenCalled();
    });
  });

  describe('Execute complete handler', () => {
    it('marks Execute as done with success feedback when all commands succeed', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      const outputs: CommandOutput[] = [
        {
          description: 'Create directory',
          command: 'mkdir test',
          output: '',
          errors: '',
          result: ExecutionResult.Success,
        },
        {
          description: 'Initialize git',
          command: 'git init',
          output: '',
          errors: '',
          result: ExecutionResult.Success,
        },
      ];

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      handlers.onComplete(outputs, 9000);

      const queueUpdater = getQueueUpdater();
      queueUpdater(mockQueue);

      expect(addToTimelineMock).toHaveBeenCalledTimes(1);
      const args = getTimelineArgs();
      const markedExecute = args[0];
      const message = args[1];

      expect(markedExecute.name).toBe(ComponentName.Execute);
      expect('state' in markedExecute && markedExecute.state.done).toBe(true);

      expect(message.name).toBe(ComponentName.Message);
      const messageProps = message.props as MessageProps;
      expect(messageProps.text).toBe('Execution completed in 9 seconds.');
    });

    it('adds failed feedback when a command fails with error message', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      const outputs: CommandOutput[] = [
        {
          description: 'Create directory',
          command: 'mkdir test',
          output: '',
          errors: '',
          result: ExecutionResult.Success,
        },
        {
          description: 'Install dependencies',
          command: 'npm install',
          output: '',
          errors: 'ERR! network',
          result: ExecutionResult.Error,
          error: 'Network error',
        },
      ];

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      handlers.onComplete(outputs, 5000);

      const queueUpdater = getQueueUpdater();
      queueUpdater(mockQueue);

      expect(addToTimelineMock).toHaveBeenCalledTimes(1);
      const args = getTimelineArgs();
      const feedback = args[1];

      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Failed);
      expect(feedbackProps.message).toBe('Install dependencies: Network error');
    });

    it('adds failed feedback with exit code when no error message', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      const outputs: CommandOutput[] = [
        {
          description: 'Run tests',
          command: 'npm test',
          output: '',
          errors: 'Test failed',
          result: ExecutionResult.Error,
        },
      ];

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      handlers.onComplete(outputs, 3000);

      const queueUpdater = getQueueUpdater();
      queueUpdater(mockQueue);

      const args = getTimelineArgs();
      const feedback = args[1];

      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Failed);
      expect(feedbackProps.message).toBe('Run tests failed');
    });

    it('returns empty queue after processing', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      const outputs: CommandOutput[] = [
        {
          description: 'Test',
          command: 'echo test',
          output: 'test',
          errors: '',
          result: ExecutionResult.Success,
        },
      ];

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      handlers.onComplete(outputs, 1000);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater(mockQueue);

      expect(result).toEqual([]);
    });

    it('handles empty queue gracefully', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );

      handlers.onComplete([], 0);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([]);

      expect(result).toEqual([]);
      expect(addToTimelineMock).not.toHaveBeenCalled();
    });
  });

  describe('Execute aborted handler', () => {
    it('adds aborted feedback with elapsed time to timeline', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );
      handlers.onAborted(1500);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([
        {
          id: '123',
          name: ComponentName.Execute,
          state: { done: false, isLoading: false },
          props: {
            tasks: [],
            onError: vi.fn(),
            onComplete: vi.fn(),
            onAborted: vi.fn(),
          },
        },
      ]);

      expect(result).toEqual([]);
      expect(addToTimelineMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: ComponentName.Execute,
          state: { done: true, isLoading: false },
        }),
        expect.objectContaining({
          name: ComponentName.Feedback,
          props: {
            type: FeedbackType.Aborted,
            message: 'The execution was cancelled after 1 second.',
          },
        })
      );
    });

    it('adds aborted feedback without time when elapsed is zero', () => {
      const handlers = createExecuteHandlers(
        ops,
        handleAbortedMock as (operationName: string) => void
      );
      handlers.onAborted(0);

      const queueUpdater = getQueueUpdater();
      queueUpdater([
        {
          id: '123',
          name: ComponentName.Execute,
          state: { done: false, isLoading: false },
          props: {
            tasks: [],
            onError: vi.fn(),
            onComplete: vi.fn(),
            onAborted: vi.fn(),
          },
        },
      ]);

      expect(addToTimelineMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: ComponentName.Feedback,
          props: {
            type: FeedbackType.Aborted,
            message: 'The execution was cancelled.',
          },
        })
      );
    });
  });
});
