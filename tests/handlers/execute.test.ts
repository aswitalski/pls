import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  FeedbackProps,
  MessageProps,
} from '../../src/types/components.js';
import { ComponentName, FeedbackType } from '../../src/types/types.js';

import {
  createExecuteAbortedHandler,
  createExecuteCompleteHandler,
  createExecuteErrorHandler,
} from '../../src/handlers/execute.js';
import { CommandOutput, ExecutionResult } from '../../src/services/shell.js';

// Mock exitApp to prevent actual process exit
vi.mock('../../src/services/process.js', () => ({
  exitApp: vi.fn(),
}));

describe('Execute handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Execute error handler', () => {
    it('marks Execute component as done and adds failed feedback', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteErrorHandler(addToTimeline);

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      const queueHandler = handler('Network error');
      queueHandler(mockQueue);

      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const args = addToTimeline.mock.calls[0] as ComponentDefinition[];
      const markedExecute = args[0];
      const feedback = args[1];

      // Execute should be marked as done
      expect(markedExecute.name).toBe(ComponentName.Execute);
      expect('state' in markedExecute && markedExecute.state.done).toBe(true);

      // Feedback should be failed type
      expect(feedback.name).toBe(ComponentName.Feedback);
      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Failed);
      expect(feedbackProps.message).toBe('Network error');
    });

    it('returns empty queue after processing', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteErrorHandler(addToTimeline);

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'execute-1',
          name: ComponentName.Execute,
          state: { done: false },
          props: { tasks: [], onAborted: vi.fn() },
        },
      ];

      const queueHandler = handler('Error');
      const result = queueHandler(mockQueue);

      expect(result).toEqual([]);
    });

    it('handles empty queue gracefully', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteErrorHandler(addToTimeline);
      const queueHandler = handler('Error');

      const result = queueHandler([]);

      expect(result).toEqual([]);
      expect(addToTimeline).not.toHaveBeenCalled();
    });
  });

  describe('Execute complete handler', () => {
    it('marks Execute as done with success feedback when all commands succeed', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteCompleteHandler(addToTimeline);

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

      const queueHandler = handler(outputs, 9000);
      queueHandler(mockQueue);

      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const args = addToTimeline.mock.calls[0] as ComponentDefinition[];
      const markedExecute = args[0];
      const message = args[1];

      // Execute should be marked as done
      expect(markedExecute.name).toBe(ComponentName.Execute);
      expect('state' in markedExecute && markedExecute.state.done).toBe(true);

      // Should be a message (not feedback)
      expect(message.name).toBe(ComponentName.Message);
      const messageProps = message.props as MessageProps;
      expect(messageProps.text).toBe('Execution completed in 9 seconds.');
    });

    it('adds failed feedback when a command fails with error message', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteCompleteHandler(addToTimeline);

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

      const queueHandler = handler(outputs, 5000);
      queueHandler(mockQueue);

      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const args = addToTimeline.mock.calls[0] as ComponentDefinition[];
      const feedback = args[1];

      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Failed);
      expect(feedbackProps.message).toBe('Install dependencies: Network error');
    });

    it('adds failed feedback with exit code when no error message', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteCompleteHandler(addToTimeline);

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

      const queueHandler = handler(outputs, 3000);
      queueHandler(mockQueue);

      const args = addToTimeline.mock.calls[0] as ComponentDefinition[];
      const feedback = args[1];

      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Failed);
      expect(feedbackProps.message).toBe('Run tests failed');
    });

    it('returns empty queue after processing', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteCompleteHandler(addToTimeline);

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

      const queueHandler = handler(outputs, 1000);
      const result = queueHandler(mockQueue);

      expect(result).toEqual([]);
    });

    it('handles empty queue gracefully', () => {
      const addToTimeline = vi.fn();

      const handler = createExecuteCompleteHandler(addToTimeline);
      const queueHandler = handler([], 0);

      const result = queueHandler([]);

      expect(result).toEqual([]);
      expect(addToTimeline).not.toHaveBeenCalled();
    });
  });

  describe('Execute aborted handler', () => {
    it('calls handleAborted with operation name', () => {
      const handleAborted = vi.fn();

      const handler = createExecuteAbortedHandler(handleAborted);
      handler();

      expect(handleAborted).toHaveBeenCalledWith('Execution');
    });
  });
});
