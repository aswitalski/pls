import { describe, expect, it, vi } from 'vitest';

import { ComponentName, TaskType } from '../../src/types/types.js';
import { ComponentDefinition } from '../../src/types/components.js';

import { LLMService } from '../../src/services/anthropic.js';
import {
  getOperationName,
  routeTasksWithConfirm,
} from '../../src/services/task-router.js';

import { createMockHandlers } from '../test-utils.js';

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
      const handlers = createMockHandlers();

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
      const handlers = createMockHandlers();

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

    it('adds Plan to queue, which adds Confirm when completed', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute },
        { action: 'npm test', type: TaskType.Execute },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Build project',
        {} as LLMService,
        'build',
        handlers,
        false
      );

      // First call adds Plan only
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(handlers.addToTimeline).not.toHaveBeenCalled();

      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing (calls onSelectionConfirmed)
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Second call adds Confirm
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);
    });

    it('routes to Answer component when all tasks are Answer type', () => {
      const tasks = [{ action: 'Explain unit testing', type: TaskType.Answer }];
      const service = {} as LLMService;
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer question',
        service,
        'explain testing',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending, then add Answer to queue
      expect(handlers.completeActiveAndPending).toHaveBeenCalledTimes(1);
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);

      const answerDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
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
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'List capabilities',
        service,
        'list skills',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Introspect to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const introspectDef = (handlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
      expect(introspectDef.name).toBe(ComponentName.Introspect);
      if (introspectDef.name === ComponentName.Introspect) {
        expect(introspectDef.props.tasks).toEqual(tasks);
        expect(introspectDef.props.service).toBe(service);
      }
    });

    it('routes to Execute component when tasks are Execute type with no missing config', () => {
      const tasks = [{ action: 'npm install', type: TaskType.Execute }];
      const service = {} as LLMService;
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        service,
        'install',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Execute to queue (no Validate needed)
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const executeDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
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
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Deploy to alpha',
        service,
        'deploy alpha',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const validateDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
      expect(validateDef.name).toBe(ComponentName.Validate);
      if (validateDef.name === ComponentName.Validate) {
        expect(validateDef.props.missingConfig).toEqual([
          { path: 'product.alpha.path', type: 'string' },
        ]);
        expect(validateDef.props.userRequest).toBe('deploy alpha');
        expect(validateDef.props.service).toBe(service);
      }
    });

    it('completes both components and shows cancellation when user cancels confirmation', () => {
      const tasks = [{ action: 'npm install', type: TaskType.Execute }];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        {} as LLMService,
        'install',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(handlers.completeActiveAndPending).toHaveBeenCalledTimes(1);

      // Should add feedback to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('completes both components and shows cancellation when user cancels introspect flow', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Capabilities',
        {} as LLMService,
        'list',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(handlers.completeActiveAndPending).toHaveBeenCalledTimes(1);

      // Should add feedback to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('completes both components and shows cancellation when user cancels answer flow', () => {
      const tasks = [{ action: 'Explain testing', type: TaskType.Answer }];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer',
        {} as LLMService,
        'explain',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(handlers.completeActiveAndPending).toHaveBeenCalledTimes(1);

      // Should add feedback to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('shows error after user confirms plan with mixed task types', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute },
        { action: 'Explain testing', type: TaskType.Answer },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        {} as LLMService,
        'build and explain',
        handlers,
        false
      );

      // Plan should be added to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(handlers.addToTimeline).not.toHaveBeenCalled();

      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Confirm should be added to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending components
      expect(handlers.completeActiveAndPending).toHaveBeenCalledTimes(1);

      // Should call onError with mixed types error message
      expect(handlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (handlers.onError as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(errorMessage).toContain('execute');
      expect(errorMessage).toContain('answer');
    });

    it('filters out Ignore and Discard tasks before validation', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute },
        { action: 'Ignore unknown request', type: TaskType.Ignore },
        { action: 'Discarded option', type: TaskType.Discard },
      ];
      const handlers = createMockHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Execute with ignored tasks',
        service,
        'build',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should not trigger error (only Execute tasks validated)
      expect(handlers.onError).not.toHaveBeenCalled();

      // Should add Execute component (only valid task type)
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const executeDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
      expect(executeDef.name).toBe(ComponentName.Execute);
    });

    it('routes to Config component when all tasks are Config type', () => {
      const tasks = [
        {
          action: 'Anthropic API key',
          type: TaskType.Config,
          params: { key: 'anthropic.key' },
        },
        {
          action: 'Anthropic model',
          type: TaskType.Config,
          params: { key: 'anthropic.model' },
        },
      ];
      const service = {} as LLMService;
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure settings',
        service,
        'config',
        handlers,
        false
      );

      // Get Plan from first addToQueue call
      const planDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(planDef.name).toBe(ComponentName.Plan);

      // Simulate Plan completing
      if (planDef.name === ComponentName.Plan) {
        void planDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Config component to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(3);
      const configDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[2][0] as ComponentDefinition;
      expect(configDef.name).toBe(ComponentName.Config);
      if (configDef.name === ComponentName.Config) {
        // Should have steps for both config keys
        expect(configDef.props.steps).toBeDefined();
        expect(configDef.props.steps.length).toBe(2);
      }
    });

    it('shows message when all tasks are Ignore type', () => {
      const tasks = [
        { action: 'Ignore unknown "test" request', type: TaskType.Ignore },
        { action: 'Ignore unknown "validate" request', type: TaskType.Ignore },
      ];
      const service = {} as LLMService;
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Here is what I found',
        service,
        'test and validate',
        handlers,
        false
      );

      // Should add Message component to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);
      const messageDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;

      expect(messageDef.name).toBe(ComponentName.Message);
      if (messageDef.name === ComponentName.Message) {
        // Message should be one of the unknown request variants
        const possibleMessages = [
          'I do not understand the request.',
          'I cannot understand what you want me to do.',
          "I'm not sure what you're asking for.",
          'I cannot determine what action to take.',
          'This request is unclear to me.',
          'I do not recognize this command.',
        ];
        expect(possibleMessages).toContain(messageDef.props.text);
      }
    });
  });
});
