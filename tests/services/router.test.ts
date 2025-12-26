import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { saveConfigLabels } from '../../src/services/config-labels.js';

import {
  createErrorHandlers,
  createQueueHandlers,
  createWorkflowHandlers,
} from '../test-utils.js';

// Mock saveConfigLabels to avoid file system operations in tests
vi.mock('../../src/services/config-labels.js', () => ({
  saveConfigLabels: vi.fn(),
  saveConfigLabel: vi.fn(),
  loadConfigLabels: vi.fn().mockReturnValue({}),
  getConfigLabel: vi.fn().mockReturnValue(undefined),
}));

describe('Task Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        [],
        'Empty message',
        {} as LLMService,
        'test command',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      expect(queueHandlers.addToQueue).not.toHaveBeenCalled();
      expect(workflowHandlers.addToTimeline).not.toHaveBeenCalled();
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Select environment',
        {} as LLMService,
        'deploy app',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        true
      );

      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(workflowHandlers.addToTimeline).not.toHaveBeenCalled();

      const queuedComponent = (
        queueHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Build project',
        {} as LLMService,
        'build',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // First call adds Plan only
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(workflowHandlers.addToTimeline).not.toHaveBeenCalled();

      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing (calls onSelectionConfirmed)
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Second call adds Confirm
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);
    });

    it('auto-completes Schedule and triggers Confirm flow for concrete tasks', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Building and testing.',
        {} as LLMService,
        'build and test',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false // No DEFINE tasks
      );

      // Should have added Schedule to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
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
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Verify Confirm has proper callbacks
      const confirmProps = confirmDef.props as ConfirmDefinitionProps;
      expect(confirmProps.onConfirmed).toBeDefined();
      expect(confirmProps.onCancelled).toBeDefined();

      // Simulate user confirming
      confirmProps.onConfirmed();

      // Should complete both components
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalled();

      // Should route tasks to execution
      expect(queueHandlers.addToQueue).toHaveBeenCalled();
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Select environment.',
        {} as LLMService,
        'deploy',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        true // Has DEFINE tasks
      );

      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer question',
        service,
        'explain testing',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending, then add Answer to queue
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);

      const answerDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
      expect(answerDef.name).toBe(ComponentName.Answer);
      if (answerDef.name === ComponentName.Answer) {
        expect(answerDef.props.question).toBe('Explain unit testing');
        expect(answerDef.props.service).toBe(service);
      }
    });

    it('creates separate Answer components for multiple Answer tasks', () => {
      const tasks = [
        { action: 'Explain React', type: TaskType.Answer, config: [] },
        { action: 'Explain Vue', type: TaskType.Answer, config: [] },
        { action: 'Explain Angular', type: TaskType.Answer, config: [] },
      ];
      const service = {} as LLMService;
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer questions',
        service,
        'explain react, vue, angular',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending, then add 3 Answer components to queue
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(5); // Schedule, Confirm, Answer1, Answer2, Answer3

      // Verify first Answer component
      const answer1Def = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
      expect(answer1Def.name).toBe(ComponentName.Answer);
      if (answer1Def.name === ComponentName.Answer) {
        expect(answer1Def.props.question).toBe('Explain React');
        expect(answer1Def.props.service).toBe(service);
      }

      // Verify second Answer component
      const answer2Def = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[3][0] as ComponentDefinition;
      expect(answer2Def.name).toBe(ComponentName.Answer);
      if (answer2Def.name === ComponentName.Answer) {
        expect(answer2Def.props.question).toBe('Explain Vue');
        expect(answer2Def.props.service).toBe(service);
      }

      // Verify third Answer component
      const answer3Def = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[4][0] as ComponentDefinition;
      expect(answer3Def.name).toBe(ComponentName.Answer);
      if (answer3Def.name === ComponentName.Answer) {
        expect(answer3Def.props.question).toBe('Explain Angular');
        expect(answer3Def.props.service).toBe(service);
      }
    });

    it('routes to Introspect component when all tasks are Introspect type', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect, config: [] },
        { action: 'Show skills', type: TaskType.Introspect, config: [] },
      ];
      const service = {} as LLMService;
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'List capabilities',
        service,
        'list skills',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Introspect to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const introspectDef = (
        queueHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        service,
        'install',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Execute to queue (no Validate needed)
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const executeDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Deploy to alpha',
        service,
        'deploy alpha',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const validateDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        {} as LLMService,
        'install',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should add feedback to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('completes both components and shows cancellation when user cancels introspect flow', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect, config: [] },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Capabilities',
        {} as LLMService,
        'list',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should add feedback to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('completes both components and shows cancellation when user cancels answer flow', () => {
      const tasks = [
        { action: 'Explain testing', type: TaskType.Answer, config: [] },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer',
        {} as LLMService,
        'explain',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should add feedback to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Mixed group tasks',
        {} as LLMService,
        'build and explain',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Plan should be added to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(workflowHandlers.addToTimeline).not.toHaveBeenCalled();

      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Confirm should be added to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending components
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should call onError with mixed types error message
      expect(errorHandlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (errorHandlers.onError as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as string;
      expect(errorMessage).toContain('execute');
      expect(errorMessage).toContain('answer');
    });

    it('filters out Ignore and Discard tasks before validation', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
        { action: 'Ignore unknown request', type: TaskType.Ignore, config: [] },
        { action: 'Discarded option', type: TaskType.Discard, config: [] },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Execute with ignored tasks',
        service,
        'build',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should not trigger error (only Execute tasks validated)
      expect(errorHandlers.onError).not.toHaveBeenCalled();

      // Should add Execute component (only valid task type)
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const executeDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure settings',
        service,
        'config',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Config component to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const configDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[2][0] as ComponentDefinition;
      expect(configDef.name).toBe(ComponentName.Config);
      if (configDef.name === ComponentName.Config) {
        // Should have steps for both config keys
        expect(configDef.props.steps).toBeDefined();
        expect(configDef.props.steps.length).toBe(2);
      }
    });

    it('caches config labels when routing Config tasks', () => {
      const tasks = [
        {
          action: 'Project Alpha repository path',
          type: TaskType.Config,
          params: { key: 'project.alpha.path' },
          config: [],
        },
        {
          action: 'Project Beta repository path',
          type: TaskType.Config,
          params: { key: 'project.beta.path' },
          config: [],
        },
      ];
      const service = {} as LLMService;
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure projects',
        service,
        'config',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Verify saveConfigLabels was called with task descriptions
      expect(saveConfigLabels).toHaveBeenCalledWith({
        'project.alpha.path': 'Project Alpha repository path',
        'project.beta.path': 'Project Beta repository path',
      });
    });

    it('does not cache labels for schema config keys', () => {
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
        {
          action: 'Project Alpha repository path',
          type: TaskType.Config,
          params: { key: 'project.alpha.path' },
          config: [],
        },
      ];
      const service = {} as LLMService;
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure settings',
        service,
        'config',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Verify saveConfigLabels was called with ONLY non-schema keys
      expect(saveConfigLabels).toHaveBeenCalledWith({
        'project.alpha.path': 'Project Alpha repository path',
      });
    });

    it('does not cache labels for Config tasks without keys', () => {
      const tasks = [
        {
          action: 'Configure settings',
          type: TaskType.Config,
          params: { query: 'app' }, // No 'key' param
          config: [],
        },
      ];
      const service = {} as LLMService;
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure app',
        service,
        'config',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Verify saveConfigLabels was NOT called (no keys to cache)
      expect(saveConfigLabels).not.toHaveBeenCalled();
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Here is what I found',
        service,
        'test and validate',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Should add Message component to queue
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);
      const messageDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;

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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'explain tdd and build',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Should create Plan and not error
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(errorHandlers.onError).not.toHaveBeenCalled();

      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan and Confirm completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route Answer and Execute separately
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Workflow',
        service,
        'complete workflow',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to Execute with flattened subtasks (3 tasks)
      const executeDef = (
        queueHandlers.addToQueue as ReturnType<typeof vi.fn>
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Multiple groups',
        service,
        'build and config',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Should not error
      expect(errorHandlers.onError).not.toHaveBeenCalled();

      // Simulate Plan and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to both Execute and Config
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Config })
      );
    });

    it('creates separate Execute components for multiple Execute Groups', () => {
      const tasks = [
        {
          action: 'Deploy frontend',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to frontend',
              type: TaskType.Execute,
              config: [],
            },
            {
              action: 'Install dependencies',
              type: TaskType.Execute,
              config: [],
            },
            { action: 'Deploy frontend', type: TaskType.Execute, config: [] },
          ],
        },
        {
          action: 'Deploy backend',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to backend',
              type: TaskType.Execute,
              config: [],
            },
            {
              action: 'Install dependencies',
              type: TaskType.Execute,
              config: [],
            },
            { action: 'Deploy backend', type: TaskType.Execute, config: [] },
          ],
        },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Deploy projects',
        service,
        'deploy frontend, deploy backend',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should create TWO separate Execute components, not one merged component
      const executeComponents = (
        queueHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Execute);

      expect(executeComponents).toHaveLength(2);

      // Verify first Execute component has 3 tasks from Deploy frontend group
      expect(executeComponents[0].name).toBe(ComponentName.Execute);
      expect(executeComponents[0].props.tasks).toHaveLength(3);
      expect(executeComponents[0].props.tasks[0].action).toBe(
        'Navigate to frontend'
      );

      // Verify second Execute component has 3 tasks from Deploy backend group
      expect(executeComponents[1].name).toBe(ComponentName.Execute);
      expect(executeComponents[1].props.tasks).toHaveLength(3);
      expect(executeComponents[1].props.tasks[0].action).toBe(
        'Navigate to backend'
      );
    });

    it('preserves order when mixing Answer tasks with Execute Groups', () => {
      const tasks = [
        { action: 'Explain GraphQL', type: TaskType.Answer, config: [] },
        {
          action: 'Deploy frontend',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to frontend',
              type: TaskType.Execute,
              config: [],
            },
            { action: 'Deploy frontend', type: TaskType.Execute, config: [] },
          ],
        },
        {
          action: 'Deploy backend',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to backend',
              type: TaskType.Execute,
              config: [],
            },
            { action: 'Deploy backend', type: TaskType.Execute, config: [] },
          ],
        },
        { action: 'Explain REST', type: TaskType.Answer, config: [] },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'explain graphql, deploy frontend, deploy backend, explain rest',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get all components added to queue after Schedule and Confirm
      const components = (
        queueHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2) // Skip Schedule and Confirm
        .map((call) => call[0] as ComponentDefinition);

      // Should have: Answer, Execute (frontend), Execute (backend), Answer
      expect(components).toHaveLength(4);
      expect(components[0].name).toBe(ComponentName.Answer);
      expect(components[1].name).toBe(ComponentName.Execute);
      expect(components[2].name).toBe(ComponentName.Execute);
      expect(components[3].name).toBe(ComponentName.Answer);

      // Verify Answer questions
      if (components[0].name === ComponentName.Answer) {
        expect(components[0].props.question).toBe('Explain GraphQL');
      }
      if (components[3].name === ComponentName.Answer) {
        expect(components[3].props.question).toBe('Explain REST');
      }

      // Verify Execute groups are separate
      if (components[1].name === ComponentName.Execute) {
        expect(components[1].props.tasks).toHaveLength(2);
        expect(components[1].props.tasks[0].action).toBe(
          'Navigate to frontend'
        );
      }
      if (components[2].name === ComponentName.Execute) {
        expect(components[2].props.tasks).toHaveLength(2);
        expect(components[2].props.tasks[0].action).toBe('Navigate to backend');
      }
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Multiple types',
        service,
        'answer, execute, introspect',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to all three component types
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Invalid mixed group',
        {} as LLMService,
        'mixed group',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should call onError with mixed types message
      expect(errorHandlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (errorHandlers.onError as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as string;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'With empty group',
        service,
        'empty and execute',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Should not error
      expect(errorHandlers.onError).not.toHaveBeenCalled();

      // Simulate Plan and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route Execute task (empty Group is skipped during flattening)
      expect(queueHandlers.addToQueue).toHaveBeenCalledWith(
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Nested mixed group',
        {} as LLMService,
        'nested',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should detect mixed types in nested Group
      expect(errorHandlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (errorHandlers.onError as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as string;
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
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasks,
        'Group with ignores',
        {} as LLMService,
        'ignores',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Group itself is not filtered (it's not Ignore type, it's Group type)
      // Plan is created, showing the Group with its Ignore subtasks
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // When user confirms, Ignore subtasks are flattened but have no handler
      // So nothing gets executed
      void (
        scheduleDef.props as ScheduleDefinitionProps
      ).onSelectionConfirmed?.(tasks);

      const confirmDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      (confirmDef.props as ConfirmDefinitionProps).onConfirmed();

      // After confirmation, Ignore tasks have no handler, so nothing is queued
      expect(workflowHandlers.completeActiveAndPending).toHaveBeenCalled();
      // Only Plan and Confirm were queued, no Execute/Answer/etc
      expect(queueHandlers.addToQueue).toHaveBeenCalledTimes(2);
    });

    it('filters Ignore tasks early from Groups', () => {
      // Create tasks with Ignore type at top level
      const tasksWithIgnore = [
        { action: 'Execute 1', type: TaskType.Execute, config: [] },
        { action: 'Ignore 1', type: TaskType.Ignore, config: [] },
        { action: 'Execute 2', type: TaskType.Execute, config: [] },
      ];
      const queueHandlers = createQueueHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const errorHandlers = createErrorHandlers();

      routeTasksWithConfirm(
        tasksWithIgnore,
        'Mixed tasks',
        {} as LLMService,
        'mixed',
        queueHandlers,
        workflowHandlers,
        errorHandlers,
        false
      );

      // Should filter out Ignore task before creating Plan
      // Plan should only contain Execute tasks
      const scheduleDef = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as ComponentDefinition;
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
