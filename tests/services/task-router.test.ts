import { describe, expect, it, vi } from 'vitest';

import { ComponentName, TaskType } from '../../src/types/types.js';
import { ComponentDefinition, Handlers } from '../../src/types/components.js';

import {
  getOperationName,
  routeTasksWithConfirm,
} from '../../src/services/task-router.js';
import { LLMService } from '../../src/services/anthropic.js';

describe('Task Router', () => {
  describe('getOperationName', () => {
    it('returns "introspection" when all tasks are Introspect type', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect },
        { action: 'Show skills', type: TaskType.Introspect },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('introspection');
    });

    it('returns "answer" when all tasks are Answer type', () => {
      const tasks = [
        { action: 'Explain unit testing', type: TaskType.Answer },
        { action: 'Describe Docker', type: TaskType.Answer },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('answer');
    });

    it('returns "execution" when all tasks are Execute type', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute },
        { action: 'npm test', type: TaskType.Execute },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('execution');
    });

    it('returns "execution" when tasks are mixed types', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute },
        { action: 'Explain testing', type: TaskType.Answer },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('execution');
    });

    it('returns "introspection" for empty task array (every returns true)', () => {
      const tasks: never[] = [];

      const result = getOperationName(tasks);

      // Note: Array.every() returns true for empty arrays, so empty tasks
      // match the first condition (all tasks are Introspect)
      expect(result).toBe('introspection');
    });
  });

  describe('routeTasksWithConfirm', () => {
    it('does nothing when tasks array is empty', () => {
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
      };

      routeTasksWithConfirm(
        [],
        'Empty message',
        {} as LLMService,
        'test command',
        handlers,
        false
      );

      expect(handlers.addToQueue).not.toHaveBeenCalled();
      expect(handlers.addToTimeline).not.toHaveBeenCalled();
    });

    it('adds Plan to queue when hasDefineTask is true', () => {
      const tasks = [
        {
          action: 'Choose environment',
          type: TaskType.Define,
          params: { options: ['Dev', 'Prod'] },
        },
      ];
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Select environment',
        {} as LLMService,
        'deploy app',
        handlers,
        true
      );

      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(handlers.addToTimeline).not.toHaveBeenCalled();

      const queuedComponent = (handlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(queuedComponent.name).toBe(ComponentName.Plan);
      if (queuedComponent.name === ComponentName.Plan) {
        expect(queuedComponent.props.message).toBe('Select environment');
        expect(queuedComponent.props.tasks).toEqual(tasks);
      }
    });

    it('adds Plan to timeline and Confirm to queue when hasDefineTask is false', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute },
        { action: 'npm test', type: TaskType.Execute },
      ];
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Build project',
        {} as LLMService,
        'build',
        handlers,
        false
      );

      expect(handlers.addToTimeline).toHaveBeenCalledTimes(1);
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);

      const timelineComponent = (
        handlers.addToTimeline as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(timelineComponent.name).toBe(ComponentName.Plan);

      const queuedComponent = (handlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(queuedComponent.name).toBe(ComponentName.Confirm);
    });

    it('routes to Answer component when all tasks are Answer type', () => {
      const tasks = [{ action: 'Explain unit testing', type: TaskType.Answer }];
      const service = {} as LLMService;
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Answer question',
        service,
        'explain testing',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onConfirmed
      ) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and add Answer to queue
      expect(handlers.completeActive).toHaveBeenCalledTimes(1);
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);

      const answerDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(answerDef.name).toBe(ComponentName.Answer);
      if (answerDef.name === ComponentName.Answer) {
        expect(answerDef.props.question).toBe('Explain unit testing');
        expect(answerDef.props.service).toBe(service);
      }
    });

    it('routes to Introspect component when all tasks are Introspect type', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect },
        { action: 'Show skills', type: TaskType.Introspect },
      ];
      const service = {} as LLMService;
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'List capabilities',
        service,
        'list skills',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      // Simulate user confirming
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onConfirmed
      ) {
        confirmDef.props.onConfirmed();
      }

      // Should add Introspect to queue
      const introspectDef = (handlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(introspectDef.name).toBe(ComponentName.Introspect);
      if (introspectDef.name === ComponentName.Introspect) {
        expect(introspectDef.props.tasks).toEqual(tasks);
        expect(introspectDef.props.service).toBe(service);
      }
    });

    it('routes to Execute component when tasks are Execute type with no missing config', () => {
      const tasks = [{ action: 'npm install', type: TaskType.Execute }];
      const service = {} as LLMService;
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        service,
        'install',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      // Simulate user confirming
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onConfirmed
      ) {
        confirmDef.props.onConfirmed();
      }

      // Should add Execute to queue (no Validate needed)
      const executeDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(executeDef.name).toBe(ComponentName.Execute);
      if (executeDef.name === ComponentName.Execute) {
        expect(executeDef.props.tasks).toEqual(tasks);
        expect(executeDef.props.service).toBe(service);
      }
    });

    it('routes to Validate then Execute when tasks have missing config', () => {
      const tasks = [
        { action: '{product.alpha.path}', type: TaskType.Execute },
      ];
      const service = {} as LLMService;
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Deploy to alpha',
        service,
        'deploy alpha',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      // Simulate user confirming
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onConfirmed
      ) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue
      const validateDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(validateDef.name).toBe(ComponentName.Validate);
      if (validateDef.name === ComponentName.Validate) {
        expect(validateDef.props.missingConfig).toEqual([
          { path: 'product.alpha.path', type: 'string' },
        ]);
        expect(validateDef.props.userRequest).toBe('deploy alpha');
        expect(validateDef.props.service).toBe(service);
      }
    });

    it('calls onAborted when user cancels confirmation', () => {
      const tasks = [{ action: 'npm install', type: TaskType.Execute }];
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        {} as LLMService,
        'install',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      // Simulate user cancelling
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onCancelled
      ) {
        confirmDef.props.onCancelled();
      }

      expect(handlers.onAborted).toHaveBeenCalledWith('execution');
    });

    it('calls onAborted with "introspection" when user cancels introspect flow', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect },
      ];
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Capabilities',
        {} as LLMService,
        'list',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      // Simulate user cancelling
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onCancelled
      ) {
        confirmDef.props.onCancelled();
      }

      expect(handlers.onAborted).toHaveBeenCalledWith('introspection');
    });

    it('calls onAborted with "answer" when user cancels answer flow', () => {
      const tasks = [{ action: 'Explain testing', type: TaskType.Answer }];
      const handlers: Handlers = {
        onComplete: vi.fn(),
        onAborted: vi.fn(),
        onError: vi.fn(),
        addToQueue: vi.fn(),
        addToTimeline: vi.fn(),
        completeActive: vi.fn(),
      };

      routeTasksWithConfirm(
        tasks,
        'Answer',
        {} as LLMService,
        'explain',
        handlers,
        false
      );

      // Get the Confirm definition
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      // Simulate user cancelling
      if (
        confirmDef.name === ComponentName.Confirm &&
        confirmDef.props.onCancelled
      ) {
        confirmDef.props.onCancelled();
      }

      expect(handlers.onAborted).toHaveBeenCalledWith('answer');
    });
  });
});
