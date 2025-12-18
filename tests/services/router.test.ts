import { describe, expect, it, vi } from 'vitest';

import { ComponentName, Task, TaskType } from '../../src/types/types.js';
import {
  ComponentDefinition,
  ConfirmDefinitionProps,
  ScheduleDefinitionProps,
} from '../../src/types/components.js';

import { LLMService } from '../../src/services/anthropic.js';
import {
  getOperationName,
  routeTasksWithConfirm,
} from '../../src/services/router.js';

import { createMockHandlers } from '../test-utils.js';

describe('Task Router', () => {
  describe('getOperationName', () => {
    it('returns "introspection" when all tasks are Introspect type', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect, config: [] },
        { action: 'Show skills', type: TaskType.Introspect, config: [] },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('introspection');
    });

    it('returns "answer" when all tasks are Answer type', () => {
      const tasks = [
        { action: 'Explain unit testing', type: TaskType.Answer, config: [] },
        { action: 'Describe Docker', type: TaskType.Answer, config: [] },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('answer');
    });

    it('returns "execution" when all tasks are Execute type', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
        { action: 'npm test', type: TaskType.Execute, config: [] },
      ];

      const result = getOperationName(tasks);

      expect(result).toBe('execution');
    });

    it('returns "execution" when tasks are mixed types', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
        { action: 'Explain testing', type: TaskType.Answer, config: [] },
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
          config: [],
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
      expect(queuedComponent.name).toBe(ComponentName.Schedule);
      if (queuedComponent.name === ComponentName.Schedule) {
        expect(queuedComponent.props.message).toBe('Select environment');
        expect(queuedComponent.props.tasks).toEqual(tasks);
      }
    });

    it('adds Plan to queue, which adds Confirm when completed', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
        { action: 'npm test', type: TaskType.Execute, config: [] },
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

      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing (calls onSelectionConfirmed)
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Second call adds Confirm
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);
    });

    it('auto-completes Schedule and triggers Confirm flow for concrete tasks', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Building and testing.',
        {} as LLMService,
        'build and test',
        handlers,
        false // No DEFINE tasks
      );

      // Should have added Schedule to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      if (scheduleDef.name === ComponentName.Schedule) {
        expect(scheduleDef.props.tasks).toEqual(tasks);
        expect(scheduleDef.props.message).toBe('Building and testing.');
      }

      // Verify Schedule has onSelectionConfirmed callback for auto-complete
      const scheduleProps = scheduleDef.props as ScheduleDefinitionProps;
      expect(scheduleProps.onSelectionConfirmed).toBeDefined();

      // Simulate Schedule component calling the callback on activation
      void scheduleProps.onSelectionConfirmed?.(tasks);

      // Should have added Confirm component
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Verify Confirm has proper callbacks
      const confirmProps = confirmDef.props as ConfirmDefinitionProps;
      expect(confirmProps.onConfirmed).toBeDefined();
      expect(confirmProps.onCancelled).toBeDefined();

      // Simulate user confirming
      confirmProps.onConfirmed();

      // Should complete both components
      expect(handlers.completeActiveAndPending).toHaveBeenCalled();

      // Should route tasks to execution
      expect(handlers.addToQueue).toHaveBeenCalled();
    });

    it('does not add callback to Schedule when DEFINE tasks exist', () => {
      const tasks = [
        {
          action: 'Choose environment',
          type: TaskType.Define,
          params: { options: ['Dev', 'Prod'] },
          config: [],
        },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Select environment.',
        {} as LLMService,
        'deploy',
        handlers,
        true // Has DEFINE tasks
      );

      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Schedule with DEFINE tasks should NOT have onSelectionConfirmed
      // because user needs to manually select options first
      const scheduleProps = scheduleDef.props as ScheduleDefinitionProps;
      expect(scheduleProps.onSelectionConfirmed).toBeUndefined();
    });

    it('routes to Answer component when all tasks are Answer type', () => {
      const tasks = [
        { action: 'Explain unit testing', type: TaskType.Answer, config: [] },
      ];
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
        { action: 'List capabilities', type: TaskType.Introspect, config: [] },
        { action: 'Show skills', type: TaskType.Introspect, config: [] },
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
      const tasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
      ];
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
        {
          action: 'Deploy to alpha',
          type: TaskType.Execute,
          config: ['product.alpha.path'],
        },
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
      const tasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
      ];
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
        { action: 'List capabilities', type: TaskType.Introspect, config: [] },
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
      const tasks = [
        { action: 'Explain testing', type: TaskType.Answer, config: [] },
      ];
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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

    it('shows error after user confirms plan with mixed task types in a group', () => {
      const tasks = [
        {
          action: 'Complete tasks',
          type: TaskType.Group,
          subtasks: [
            { action: 'Build project', type: TaskType.Execute, config: [] },
            { action: 'Explain testing', type: TaskType.Answer, config: [] },
          ],
        },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Mixed group tasks',
        {} as LLMService,
        'build and explain',
        handlers,
        false
      );

      // Plan should be added to queue
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(handlers.addToTimeline).not.toHaveBeenCalled();

      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
        { action: 'Build project', type: TaskType.Execute, config: [] },
        { action: 'Ignore unknown request', type: TaskType.Ignore, config: [] },
        { action: 'Discarded option', type: TaskType.Discard, config: [] },
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
          config: [],
        },
        {
          action: 'Anthropic model',
          type: TaskType.Config,
          params: { key: 'anthropic.model' },
          config: [],
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
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
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
        {
          action: 'Ignore unknown "test" request',
          type: TaskType.Ignore,
          config: [],
        },
        {
          action: 'Ignore unknown "validate" request',
          type: TaskType.Ignore,
          config: [],
        },
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

  describe('Group tasks and mixed types', () => {
    it('allows mixed types at top level (Answer + Group)', () => {
      const tasks = [
        { action: 'Explain TDD', type: TaskType.Answer, config: [] },
        {
          action: 'Build project',
          type: TaskType.Group,
          subtasks: [
            { action: 'Compile code', type: TaskType.Execute, config: [] },
            { action: 'Run tests', type: TaskType.Execute, config: [] },
          ],
        },
      ];
      const handlers = createMockHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'explain tdd and build',
        handlers,
        false
      );

      // Should create Plan and not error
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(handlers.onError).not.toHaveBeenCalled();

      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan and Confirm completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route Answer and Execute separately
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
    });

    it('flattens Group tasks to extract subtasks for execution', () => {
      const tasks = [
        {
          action: 'Complete workflow',
          type: TaskType.Group,
          subtasks: [
            { action: 'Step 1', type: TaskType.Execute, config: [] },
            { action: 'Step 2', type: TaskType.Execute, config: [] },
            { action: 'Step 3', type: TaskType.Execute, config: [] },
          ],
        },
      ];
      const handlers = createMockHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Workflow',
        service,
        'complete workflow',
        handlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to Execute with flattened subtasks (3 tasks)
      const executeDef = (
        handlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (call) =>
          (call[0] as ComponentDefinition).name === ComponentName.Execute
      )?.[0] as ComponentDefinition | undefined;

      expect(executeDef).toBeDefined();
      if (executeDef?.name === ComponentName.Execute) {
        expect(executeDef.props.tasks).toHaveLength(3);
      }
    });

    it('handles multiple Groups with different subtask types', () => {
      const tasks = [
        {
          action: 'Build tasks',
          type: TaskType.Group,
          subtasks: [
            { action: 'Compile', type: TaskType.Execute, config: [] },
            { action: 'Package', type: TaskType.Execute, config: [] },
          ],
        },
        {
          action: 'Config tasks',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Set debug',
              type: TaskType.Config,
              params: { key: 'debug', value: 'true' },
              config: [],
            },
            {
              action: 'Set mode',
              type: TaskType.Config,
              params: { key: 'mode', value: 'dev' },
              config: [],
            },
          ],
        },
      ];
      const handlers = createMockHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Multiple groups',
        service,
        'build and config',
        handlers,
        false
      );

      // Should not error
      expect(handlers.onError).not.toHaveBeenCalled();

      // Simulate Plan and Confirm completing
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to both Execute and Config
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Config })
      );
    });

    it('groups flattened tasks by type and routes each group', () => {
      const tasks = [
        { action: 'Answer question', type: TaskType.Answer, config: [] },
        {
          action: 'Execute group',
          type: TaskType.Group,
          subtasks: [
            { action: 'Task 1', type: TaskType.Execute, config: [] },
            { action: 'Task 2', type: TaskType.Execute, config: [] },
          ],
        },
        { action: 'Show capabilities', type: TaskType.Introspect, config: [] },
      ];
      const handlers = createMockHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Multiple types',
        service,
        'answer, execute, introspect',
        handlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to all three component types
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Introspect })
      );
    });

    it('validates that Group subtasks must have uniform types', () => {
      const tasks = [
        {
          action: 'Mixed group',
          type: TaskType.Group,
          subtasks: [
            { action: 'Execute task', type: TaskType.Execute, config: [] },
            { action: 'Answer task', type: TaskType.Answer, config: [] },
          ],
        },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Invalid mixed group',
        {} as LLMService,
        'mixed group',
        handlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should call onError with mixed types message
      expect(handlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (handlers.onError as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(errorMessage).toContain('Mixed task types');
      expect(errorMessage).toContain('execute');
      expect(errorMessage).toContain('answer');
    });

    it('allows empty Groups to pass validation', () => {
      const tasks = [
        {
          action: 'Empty group',
          type: TaskType.Group,
          subtasks: [],
        },
        { action: 'Execute task', type: TaskType.Execute, config: [] },
      ];
      const handlers = createMockHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'With empty group',
        service,
        'empty and execute',
        handlers,
        false
      );

      // Should not error
      expect(handlers.onError).not.toHaveBeenCalled();

      // Simulate Plan and Confirm completing
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route Execute task (empty Group is skipped during flattening)
      expect(handlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
    });

    it('validates nested Groups recursively', () => {
      const tasks = [
        {
          action: 'Parent group',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Child group',
              type: TaskType.Group,
              subtasks: [
                { action: 'Execute 1', type: TaskType.Execute, config: [] },
                { action: 'Answer 1', type: TaskType.Answer, config: [] },
              ],
            },
          ],
        },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Nested mixed group',
        {} as LLMService,
        'nested',
        handlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should detect mixed types in nested Group
      expect(handlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (handlers.onError as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(errorMessage).toContain('Mixed task types');
    });

    it('handles Groups with only Ignore tasks', () => {
      const tasks = [
        {
          action: 'Group with only ignores',
          type: TaskType.Group,
          subtasks: [
            { action: 'Ignore 1', type: TaskType.Ignore, config: [] },
            { action: 'Ignore 2', type: TaskType.Ignore, config: [] },
          ],
        },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasks,
        'Group with ignores',
        {} as LLMService,
        'ignores',
        handlers,
        false
      );

      // Group itself is not filtered (it's not Ignore type, it's Group type)
      // Plan is created, showing the Group with its Ignore subtasks
      expect(handlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // When user confirms, Ignore subtasks are flattened but have no handler
      // So nothing gets executed
      void (
        scheduleDef.props as ScheduleDefinitionProps
      ).onSelectionConfirmed?.(tasks);

      const confirmDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      (confirmDef.props as ConfirmDefinitionProps).onConfirmed();

      // After confirmation, Ignore tasks have no handler, so nothing is queued
      expect(handlers.completeActiveAndPending).toHaveBeenCalled();
      // Only Plan and Confirm were queued, no Execute/Answer/etc
      expect(handlers.addToQueue).toHaveBeenCalledTimes(2);
    });

    it('filters Ignore tasks early from Groups', () => {
      // Create tasks with Ignore type at top level
      const tasksWithIgnore = [
        { action: 'Execute 1', type: TaskType.Execute, config: [] },
        { action: 'Ignore 1', type: TaskType.Ignore, config: [] },
        { action: 'Execute 2', type: TaskType.Execute, config: [] },
      ];
      const handlers = createMockHandlers();

      routeTasksWithConfirm(
        tasksWithIgnore,
        'Mixed tasks',
        {} as LLMService,
        'mixed',
        handlers,
        false
      );

      // Should filter out Ignore task before creating Plan
      // Plan should only contain Execute tasks
      const scheduleDef = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Verify filtered tasks only contain Execute tasks
      const scheduleTasks = (scheduleDef.props as ScheduleDefinitionProps)
        .tasks;
      expect(scheduleTasks.length).toBe(2);
      scheduleTasks.forEach((task: Task) => {
        expect(task.type).toBe(TaskType.Execute);
      });
    });
  });
});
