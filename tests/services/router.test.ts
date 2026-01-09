import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentName,
  FeedbackType,
  Task,
  TaskType,
} from '../../src/types/types.js';
import {
  AnswerDefinitionProps,
  ComponentDefinition,
  ConfirmDefinitionProps,
  ExecuteDefinitionProps,
  FeedbackDefinitionProps,
  ScheduleDefinitionProps,
} from '../../src/types/components.js';

import { LLMService } from '../../src/services/anthropic.js';
import {
  flattenTasks,
  getOperationName,
  routeTasksWithConfirm,
} from '../../src/services/router.js';
import { saveConfigLabels } from '../../src/configuration/labels.js';

import {
  createRequestHandlers,
  createLifecycleHandlers,
  createWorkflowHandlers,
} from '../test-utils.js';

// Mock saveConfigLabels to avoid file system operations in tests
vi.mock('../../src/configuration/labels.js', () => ({
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

  describe('flattenTasks', () => {
    it('returns empty array for empty input', () => {
      const result = flattenTasks([]);
      expect(result).toEqual([]);
    });

    it('returns leaf tasks unchanged', () => {
      const tasks = [
        { action: 'Task 1', type: TaskType.Execute, config: [] },
        { action: 'Task 2', type: TaskType.Answer, config: [] },
      ];

      const result = flattenTasks(tasks);

      expect(result).toEqual(tasks);
    });

    it('preserves top-level group with flattened subtasks', () => {
      const tasks = [
        {
          action: 'Build project',
          type: TaskType.Group,
          subtasks: [
            { action: 'Compile', type: TaskType.Execute, config: [] },
            { action: 'Test', type: TaskType.Execute, config: [] },
          ],
        },
      ];

      const result = flattenTasks(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Build project');
      expect(result[0].type).toBe(TaskType.Group);
      expect(result[0].subtasks).toHaveLength(2);
      expect(result[0].subtasks?.[0]).toEqual({
        action: 'Compile',
        type: TaskType.Execute,
        config: [],
      });
      expect(result[0].subtasks?.[1]).toEqual({
        action: 'Test',
        type: TaskType.Execute,
        config: [],
      });
    });

    it('flattens inner nested groups but preserves top-level group', () => {
      const tasks = [
        {
          action: 'Parent',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Child group',
              type: TaskType.Group,
              subtasks: [
                { action: 'Leaf 1', type: TaskType.Execute, config: [] },
                { action: 'Leaf 2', type: TaskType.Execute, config: [] },
              ],
            },
          ],
        },
      ];

      const result = flattenTasks(tasks);

      // Top-level group is preserved
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Parent');
      expect(result[0].type).toBe(TaskType.Group);
      // Inner group is flattened, leaving only leaf tasks
      expect(result[0].subtasks).toHaveLength(2);
      expect(result[0].subtasks?.[0].action).toBe('Leaf 1');
      expect(result[0].subtasks?.[1].action).toBe('Leaf 2');
    });

    it('preserves params and config on flattened subtasks', () => {
      const tasks = [
        {
          action: 'Deploy',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate',
              type: TaskType.Execute,
              params: { skill: 'Deploy', variant: 'alpha' },
              config: ['project.alpha.path'],
            },
          ],
        },
      ];

      const result = flattenTasks(tasks);

      // Top-level group is preserved
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Deploy');
      // Subtasks have their params and config preserved
      expect(result[0].subtasks).toHaveLength(1);
      expect(result[0].subtasks?.[0].params).toEqual({
        skill: 'Deploy',
        variant: 'alpha',
      });
      expect(result[0].subtasks?.[0].config).toEqual(['project.alpha.path']);
    });

    it('skips empty groups', () => {
      const tasks = [
        { action: 'Task 1', type: TaskType.Execute, config: [] },
        {
          action: 'Empty group',
          type: TaskType.Group,
          subtasks: [],
        },
        { action: 'Task 2', type: TaskType.Execute, config: [] },
      ];

      const result = flattenTasks(tasks);

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('Task 1');
      expect(result[1].action).toBe('Task 2');
    });

    it('preserves order of standalone tasks and groups', () => {
      const tasks = [
        { action: 'Standalone 1', type: TaskType.Execute, config: [] },
        {
          action: 'Group',
          type: TaskType.Group,
          subtasks: [
            { action: 'From group 1', type: TaskType.Execute, config: [] },
            { action: 'From group 2', type: TaskType.Execute, config: [] },
          ],
        },
        { action: 'Standalone 2', type: TaskType.Execute, config: [] },
      ];

      const result = flattenTasks(tasks);

      // 3 top-level items: standalone, group, standalone
      expect(result).toHaveLength(3);
      expect(result[0].action).toBe('Standalone 1');
      expect(result[1].action).toBe('Group');
      expect(result[1].subtasks).toHaveLength(2);
      expect(result[2].action).toBe('Standalone 2');
    });

    it('handles deeply nested groups (3 levels) - preserves outer, flattens inner', () => {
      const tasks = [
        {
          action: 'Level 1',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Level 2',
              type: TaskType.Group,
              subtasks: [
                {
                  action: 'Level 3',
                  type: TaskType.Group,
                  subtasks: [
                    { action: 'Deep leaf', type: TaskType.Execute, config: [] },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const result = flattenTasks(tasks);

      // Top-level group preserved, all inner groups flattened
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Level 1');
      expect(result[0].type).toBe(TaskType.Group);
      expect(result[0].subtasks).toHaveLength(1);
      expect(result[0].subtasks?.[0].action).toBe('Deep leaf');
    });

    it('handles groups with undefined subtasks', () => {
      const tasks = [
        {
          action: 'Group without subtasks',
          type: TaskType.Group,
          // subtasks is undefined
        },
        { action: 'Leaf', type: TaskType.Execute, config: [] },
      ];

      const result = flattenTasks(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('Leaf');
    });
  });

  describe('routeTasksWithConfirm', () => {
    it('does nothing when tasks array is empty', () => {
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        [],
        'Empty message',
        {} as LLMService,
        'test command',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      expect(workflowHandlers.addToQueue).not.toHaveBeenCalled();
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Select environment',
        {} as LLMService,
        'deploy app',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        true
      );

      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(workflowHandlers.addToTimeline).not.toHaveBeenCalled();

      const queuedComponent = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Build project',
        {} as LLMService,
        'build',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // First call adds Plan only
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(workflowHandlers.addToTimeline).not.toHaveBeenCalled();

      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing (calls onSelectionConfirmed)
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Second call adds Confirm
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);
    });

    it('auto-completes Schedule and triggers Confirm flow for concrete tasks', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Building and testing.',
        {} as LLMService,
        'build and test',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false // No DEFINE tasks
      );

      // Should have added Schedule to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
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
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Verify Confirm has proper callbacks
      const confirmProps = confirmDef.props as ConfirmDefinitionProps;
      expect(confirmProps.onConfirmed).toBeDefined();
      expect(confirmProps.onCancelled).toBeDefined();

      // Simulate user confirming
      confirmProps.onConfirmed();

      // Should complete both components
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalled();

      // Should route tasks to execution
      expect(workflowHandlers.addToQueue).toHaveBeenCalled();
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Select environment.',
        {} as LLMService,
        'deploy',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        true // Has DEFINE tasks
      );

      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer question',
        service,
        'explain testing',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending, then add Answer to queue
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);

      const answerDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer questions',
        service,
        'explain react, vue, angular',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should complete active and pending, then add 3 Answer components to queue
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(5); // Schedule, Confirm, Answer1, Answer2, Answer3

      // Verify first Answer component
      const answer1Def = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(answer1Def.name).toBe(ComponentName.Answer);
      if (answer1Def.name === ComponentName.Answer) {
        expect(answer1Def.props.question).toBe('Explain React');
        expect(answer1Def.props.service).toBe(service);
      }

      // Verify second Answer component
      const answer2Def = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[3][0] as ComponentDefinition;
      expect(answer2Def.name).toBe(ComponentName.Answer);
      if (answer2Def.name === ComponentName.Answer) {
        expect(answer2Def.props.question).toBe('Explain Vue');
        expect(answer2Def.props.service).toBe(service);
      }

      // Verify third Answer component
      const answer3Def = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[4][0] as ComponentDefinition;
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'List capabilities',
        service,
        'list skills',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Introspect to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const introspectDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        service,
        'install',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Execute to queue (no Validate needed)
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const executeDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Deploy to alpha',
        service,
        'deploy alpha',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const validateDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(validateDef.name).toBe(ComponentName.Validate);
      if (validateDef.name === ComponentName.Validate) {
        expect(validateDef.props.missingConfig).toEqual([
          { path: 'product.alpha.path', type: 'string' },
        ]);
        expect(validateDef.props.userRequest).toBe('deploy alpha');
        expect(validateDef.props.service).toBe(service);
      }
    });

    it('collects all missing config from multiple tasks in a single Validate component', () => {
      const tasks = [
        {
          action: 'Build GX',
          type: TaskType.Execute,
          config: ['opera.gx.path'],
        },
        {
          action: 'Build Air',
          type: TaskType.Execute,
          config: ['opera.air.path'],
        },
      ];
      const service = {} as LLMService;
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Build browsers',
        service,
        'build gx and air',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate Confirm completing
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue with ALL missing config from both tasks
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const validateDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(validateDef.name).toBe(ComponentName.Validate);
      if (validateDef.name === ComponentName.Validate) {
        expect(validateDef.props.missingConfig).toHaveLength(2);
        expect(validateDef.props.missingConfig).toEqual(
          expect.arrayContaining([
            { path: 'opera.gx.path', type: 'string' },
            { path: 'opera.air.path', type: 'string' },
          ])
        );
      }
    });

    it('collects all missing config from multiple Groups in a single Validate component', () => {
      const tasks = [
        {
          action: 'Build GX browser',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to GX',
              type: TaskType.Execute,
              config: ['opera.gx.path'],
            },
            {
              action: 'Compile GX',
              type: TaskType.Execute,
              config: [],
            },
          ],
        },
        {
          action: 'Build Air browser',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to Air',
              type: TaskType.Execute,
              config: ['opera.air.path'],
            },
            {
              action: 'Compile Air',
              type: TaskType.Execute,
              config: [],
            },
          ],
        },
      ];
      const service = {} as LLMService;
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Build browsers',
        service,
        'build gx and air',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate Confirm completing
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue with ALL missing config from both groups
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const validateDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(validateDef.name).toBe(ComponentName.Validate);
      if (validateDef.name === ComponentName.Validate) {
        expect(validateDef.props.missingConfig).toHaveLength(2);
        expect(validateDef.props.missingConfig).toEqual(
          expect.arrayContaining([
            { path: 'opera.gx.path', type: 'string' },
            { path: 'opera.air.path', type: 'string' },
          ])
        );
      }
    });

    it('collects all missing config from mixed standalone and Group tasks', () => {
      const tasks = [
        {
          action: 'Setup environment',
          type: TaskType.Execute,
          config: ['env.path'],
        },
        {
          action: 'Build GX browser',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Navigate to GX',
              type: TaskType.Execute,
              config: ['opera.gx.path'],
            },
            {
              action: 'Compile GX',
              type: TaskType.Execute,
              config: [],
            },
          ],
        },
        {
          action: 'Deploy',
          type: TaskType.Execute,
          config: ['deploy.server'],
        },
      ];
      const service = {} as LLMService;
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Setup, build and deploy',
        service,
        'setup build and deploy',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate Confirm completing
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Validate to queue with ALL missing config from all tasks
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const validateDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(validateDef.name).toBe(ComponentName.Validate);
      if (validateDef.name === ComponentName.Validate) {
        expect(validateDef.props.missingConfig).toHaveLength(3);
        expect(validateDef.props.missingConfig).toEqual(
          expect.arrayContaining([
            { path: 'env.path', type: 'string' },
            { path: 'opera.gx.path', type: 'string' },
            { path: 'deploy.server', type: 'string' },
          ])
        );
      }
    });

    it('does not create duplicate Validate components for multiple groups', () => {
      const tasks = [
        {
          action: 'Build GX',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Compile GX',
              type: TaskType.Execute,
              config: ['opera.gx.path'],
            },
          ],
        },
        {
          action: 'Build Air',
          type: TaskType.Group,
          subtasks: [
            {
              action: 'Compile Air',
              type: TaskType.Execute,
              config: ['opera.air.path'],
            },
          ],
        },
      ];
      const service = {} as LLMService;
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Build browsers',
        service,
        'build gx and air',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate Confirm completing
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should create exactly 3 components: Schedule → Confirm → Validate
      // NOT: Schedule → Confirm → Validate (for GX) → Validate (for Air)
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);

      // Verify only one Validate component was created
      const calls = (workflowHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls;
      const validateCalls = calls.filter(
        (call) => call[0].name === ComponentName.Validate
      );
      expect(validateCalls).toHaveLength(1);
    });

    it('completes both components and shows cancellation when user cancels confirmation', () => {
      const tasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Install dependencies',
        {} as LLMService,
        'install',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should add feedback to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('completes both components and shows cancellation when user cancels introspect flow', () => {
      const tasks = [
        { action: 'List capabilities', type: TaskType.Introspect, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Capabilities',
        {} as LLMService,
        'list',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should add feedback to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('completes both components and shows cancellation when user cancels answer flow', () => {
      const tasks = [
        { action: 'Explain testing', type: TaskType.Answer, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Answer',
        {} as LLMService,
        'explain',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user cancelling
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onCancelled();
      }

      // Should complete both active and pending
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalledTimes(
        1
      );

      // Should add feedback to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const feedbackDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
      expect(feedbackDef.name).toBe(ComponentName.Feedback);
    });

    it('flattens and routes mixed task types in a group', () => {
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed group tasks',
        service,
        'build and explain',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Plan should be added to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Confirm should be added to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should NOT error - mixed types are allowed after flattening
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      // Should route to both Execute and Answer components
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
    });

    it('filters out Ignore and Discard tasks before validation', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
        { action: 'Ignore unknown request', type: TaskType.Ignore, config: [] },
        { action: 'Discarded option', type: TaskType.Discard, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Execute with ignored tasks',
        service,
        'build',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should not trigger error (only Execute tasks validated)
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      // Should add Execute component (only valid task type)
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const executeDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure settings',
        service,
        'config',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Plan from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should add Config component to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(3);
      const configDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[2][0] as ComponentDefinition;
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure projects',
        service,
        'config',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;

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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure settings',
        service,
        'config',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;

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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Configure app',
        service,
        'config',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Get Schedule from first addToQueue call
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;

      // Simulate Schedule completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      // Get Confirm from second addToQueue call
      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;

      // Simulate user confirming
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Verify saveConfigLabels was NOT called (no keys to cache)
      expect(saveConfigLabels).not.toHaveBeenCalled();
    });

    it('shows warning feedback when all tasks are Ignore type', () => {
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Here is what I found',
        service,
        'test and validate',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Should add Feedback component to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);
      const feedbackDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;

      expect(feedbackDef.name).toBe(ComponentName.Feedback);
      const props = feedbackDef.props as FeedbackDefinitionProps;
      expect(props.type).toBe(FeedbackType.Warning);
      // Message should be the action from the first ignore task + period
      expect(props.message).toBe('Ignore unknown "test" request.');
    });

    it('shows missing key param warning from Ignore task action', () => {
      const tasks = [
        {
          action: 'Missing input: specify which file to process',
          type: TaskType.Ignore,
          config: [],
        },
      ];
      const service = {} as LLMService;
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Process the file.',
        service,
        'process in batch mode',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);
      const feedbackDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;

      expect(feedbackDef.name).toBe(ComponentName.Feedback);
      const props = feedbackDef.props as FeedbackDefinitionProps;
      expect(props.type).toBe(FeedbackType.Warning);
      // Message should be the descriptive error from ignore task
      expect(props.message).toBe(
        'Missing input: specify which file to process.'
      );
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'explain tdd and build',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Should create Plan and not error
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // Simulate Plan and Confirm completing
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route Answer and Execute separately
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
    });

    it('routes Group tasks as single Execute component with label', () => {
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Workflow',
        service,
        'complete workflow',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Group becomes ONE Execute component with group name as label
      const executeComponents = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Execute);

      expect(executeComponents).toHaveLength(1);
      const executeProps = executeComponents[0].props;
      expect(executeProps.label).toBe('Complete workflow');
      expect(executeProps.tasks).toHaveLength(3);
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Multiple groups',
        service,
        'build and config',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Should not error
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      // Simulate Plan and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to both Execute and Config
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Config })
      );
    });

    it('creates one Execute component per Group with group name as label', () => {
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
            { action: 'Run deploy', type: TaskType.Execute, config: [] },
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
            { action: 'Run deploy', type: TaskType.Execute, config: [] },
          ],
        },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Deploy projects',
        service,
        'deploy frontend, deploy backend',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Each group becomes ONE Execute component with its tasks
      const executeComponents = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Execute);

      // 2 groups = 2 Execute components
      expect(executeComponents).toHaveLength(2);

      // Verify labels are group names
      const labels = executeComponents.map((c) => c.props.label);
      expect(labels).toEqual(['Deploy frontend', 'Deploy backend']);

      // Verify each has 3 tasks
      expect(executeComponents[0].props.tasks).toHaveLength(3);
      expect(executeComponents[1].props.tasks).toHaveLength(3);
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
            { action: 'Run deploy', type: TaskType.Execute, config: [] },
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
            { action: 'Run deploy', type: TaskType.Execute, config: [] },
          ],
        },
        { action: 'Explain REST', type: TaskType.Answer, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'explain graphql, deploy frontend, deploy backend, explain rest',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get all components added to queue after Schedule and Confirm
      const components = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2) // Skip Schedule and Confirm
        .map((call) => call[0] as ComponentDefinition);

      // Groups preserved: Answer, Execute (frontend), Execute (backend), Answer
      expect(components).toHaveLength(4);

      // Verify order is preserved: Answer, Execute, Execute, Answer
      expect(components[0].name).toBe(ComponentName.Answer);
      expect(components[1].name).toBe(ComponentName.Execute);
      expect(components[2].name).toBe(ComponentName.Execute);
      expect(components[3].name).toBe(ComponentName.Answer);

      // Verify first and last Answer questions
      expect((components[0].props as AnswerDefinitionProps).question).toBe(
        'Explain GraphQL'
      );
      expect((components[3].props as AnswerDefinitionProps).question).toBe(
        'Explain REST'
      );

      // Verify Execute labels are group names
      expect((components[1].props as ExecuteDefinitionProps).label).toBe(
        'Deploy frontend'
      );
      expect((components[2].props as ExecuteDefinitionProps).label).toBe(
        'Deploy backend'
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Multiple types',
        service,
        'answer, execute, introspect',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route to all three component types
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Introspect })
      );
    });

    it('flattens Group subtasks and routes mixed types', () => {
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed group',
        service,
        'mixed group',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should NOT error - Groups are flattened and mixed types are allowed
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      // Should route to both Execute and Answer
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'With empty group',
        service,
        'empty and execute',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Should not error
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      // Simulate Plan and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should route Execute task (empty Group is skipped during flattening)
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
    });

    it('flattens nested Groups recursively and routes all leaf tasks', () => {
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Nested mixed group',
        service,
        'nested',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Plan and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Should NOT error - nested Groups are flattened and mixed types allowed
      expect(requestHandlers.onError).not.toHaveBeenCalled();

      // Should route to both Execute and Answer (leaf tasks)
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Execute })
      );
      expect(workflowHandlers.addToQueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: ComponentName.Answer })
      );
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
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasks,
        'Group with ignores',
        {} as LLMService,
        'ignores',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Group itself is not filtered (it's not Ignore type, it's Group type)
      // Plan is created, showing the Group with its Ignore subtasks
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(1);

      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(scheduleDef.name).toBe(ComponentName.Schedule);

      // When user confirms, Ignore subtasks are flattened but have no handler
      // So nothing gets executed
      void (
        scheduleDef.props as ScheduleDefinitionProps
      ).onSelectionConfirmed?.(tasks);

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      expect(confirmDef.name).toBe(ComponentName.Confirm);

      (confirmDef.props as ConfirmDefinitionProps).onConfirmed();

      // After confirmation, Ignore tasks have no handler, so nothing is queued
      expect(lifecycleHandlers.completeActiveAndPending).toHaveBeenCalled();
      // Only Plan and Confirm were queued, no Execute/Answer/etc
      expect(workflowHandlers.addToQueue).toHaveBeenCalledTimes(2);
    });

    it('filters Ignore tasks early from Groups', () => {
      // Create tasks with Ignore type at top level
      const tasksWithIgnore = [
        { action: 'Execute 1', type: TaskType.Execute, config: [] },
        { action: 'Ignore 1', type: TaskType.Ignore, config: [] },
        { action: 'Execute 2', type: TaskType.Execute, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      routeTasksWithConfirm(
        tasksWithIgnore,
        'Mixed tasks',
        {} as LLMService,
        'mixed',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Should filter out Ignore task before creating Plan
      // Plan should only contain Execute tasks
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
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

  describe('Upcoming tasks', () => {
    it('passes upcoming group names to Execute component for multiple groups', () => {
      const tasks = [
        {
          action: 'Deploy frontend',
          type: TaskType.Group,
          subtasks: [
            { action: 'Build frontend', type: TaskType.Execute, config: [] },
          ],
        },
        {
          action: 'Deploy backend',
          type: TaskType.Group,
          subtasks: [
            { action: 'Build backend', type: TaskType.Execute, config: [] },
          ],
        },
        {
          action: 'Deploy database',
          type: TaskType.Group,
          subtasks: [
            { action: 'Migrate database', type: TaskType.Execute, config: [] },
          ],
        },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Deploy all',
        service,
        'deploy',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get Execute components
      const executeComponents = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Execute);

      expect(executeComponents).toHaveLength(3);

      // Upcoming uses group names (not individual task names)
      // First Execute should have upcoming: ['Deploy backend', 'Deploy database']
      const firstProps = executeComponents[0].props;
      expect(firstProps.upcoming).toEqual([
        'Deploy backend',
        'Deploy database',
      ]);

      // Second Execute should have upcoming: ['Deploy database']
      const secondProps = executeComponents[1].props;
      expect(secondProps.upcoming).toEqual(['Deploy database']);

      // Third Execute should have empty upcoming
      const thirdProps = executeComponents[2].props;
      expect(thirdProps.upcoming).toEqual([]);
    });

    it('passes upcoming names to Answer components', () => {
      const tasks = [
        { action: 'Explain React', type: TaskType.Answer, config: [] },
        { action: 'Explain Vue', type: TaskType.Answer, config: [] },
        { action: 'Explain Angular', type: TaskType.Answer, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Explain frameworks',
        service,
        'explain',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get Answer components
      const answerComponents = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Answer);

      expect(answerComponents).toHaveLength(3);

      // First Answer should have upcoming: ['Explain Vue', 'Explain Angular']
      const firstProps = answerComponents[0].props;
      expect(firstProps.upcoming).toEqual(['Explain Vue', 'Explain Angular']);

      // Second Answer should have upcoming: ['Explain Angular']
      const secondProps = answerComponents[1].props;
      expect(secondProps.upcoming).toEqual(['Explain Angular']);

      // Third Answer should have empty upcoming
      const thirdProps = answerComponents[2].props;
      expect(thirdProps.upcoming).toEqual([]);
    });

    it('includes standalone Execute tasks in upcoming', () => {
      const tasks = [
        { action: 'Install deps', type: TaskType.Execute, config: [] },
        { action: 'Run build', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Build project',
        service,
        'build',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get Execute components
      const executeComponents = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Execute);

      expect(executeComponents).toHaveLength(3);

      // First Execute should have upcoming: ['Run build', 'Run tests']
      const firstProps = executeComponents[0].props;
      expect(firstProps.upcoming).toEqual(['Run build', 'Run tests']);

      // Second Execute should have upcoming: ['Run tests']
      const secondProps = executeComponents[1].props;
      expect(secondProps.upcoming).toEqual(['Run tests']);

      // Third Execute should have empty upcoming
      const thirdProps = executeComponents[2].props;
      expect(thirdProps.upcoming).toEqual([]);
    });

    it('calculates upcoming correctly for mixed Answer and Execute tasks', () => {
      const tasks = [
        { action: 'Explain TDD', type: TaskType.Answer, config: [] },
        {
          action: 'Build project',
          type: TaskType.Group,
          subtasks: [{ action: 'Compile', type: TaskType.Execute, config: [] }],
        },
        { action: 'Explain CI/CD', type: TaskType.Answer, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'mixed',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get all routed components after Schedule and Confirm
      const components = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition);

      expect(components).toHaveLength(3);

      // Upcoming uses group name (not individual task names)
      // First Answer should see 'Build project' (group name) and second Answer
      expect(components[0].name).toBe(ComponentName.Answer);
      const firstProps = components[0].props as AnswerDefinitionProps;
      expect(firstProps.upcoming).toEqual(['Build project', 'Explain CI/CD']);

      // Execute should see second Answer upcoming
      expect(components[1].name).toBe(ComponentName.Execute);
      const executeProps = components[1].props as ExecuteDefinitionProps;
      expect(executeProps.upcoming).toEqual(['Explain CI/CD']);

      // Second Answer should have empty upcoming
      expect(components[2].name).toBe(ComponentName.Answer);
      const lastProps = components[2].props as AnswerDefinitionProps;
      expect(lastProps.upcoming).toEqual([]);
    });

    it('does not include non-Execute/Answer tasks in upcoming', () => {
      const tasks = [
        { action: 'Install deps', type: TaskType.Execute, config: [] },
        { action: 'List skills', type: TaskType.Introspect, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ];
      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const service = {} as LLMService;

      routeTasksWithConfirm(
        tasks,
        'Mixed tasks',
        service,
        'mixed',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers,
        false
      );

      // Simulate Schedule and Confirm completing
      const scheduleDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      if (scheduleDef.name === ComponentName.Schedule) {
        void scheduleDef.props.onSelectionConfirmed?.(tasks);
      }

      const confirmDef = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[1][0] as ComponentDefinition;
      if (confirmDef.name === ComponentName.Confirm) {
        confirmDef.props.onConfirmed();
      }

      // Get Execute components
      const executeComponents = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls
        .slice(2)
        .map((call) => call[0] as ComponentDefinition)
        .filter((def) => def.name === ComponentName.Execute);

      // First Execute should only see 'Run tests' (not Introspect)
      const firstProps = executeComponents[0].props;
      expect(firstProps.upcoming).toEqual(['Run tests']);

      // Second Execute should have empty upcoming
      const secondProps = executeComponents[1].props;
      expect(secondProps.upcoming).toEqual([]);
    });
  });
});
