import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  ConfigProps,
  FeedbackProps,
  StatefulComponentDefinition,
} from '../../src/types/components.js';
import {
  ComponentName,
  FeedbackType,
  TaskType,
} from '../../src/types/types.js';

import { LLMService } from '../../src/services/anthropic.js';
import { createExecutionConfirmedHandler } from '../../src/handlers/execution.js';
import { exitApp } from '../../src/services/process.js';

// Mock exitApp to prevent actual process exit
vi.mock('../../src/services/process.js', () => ({
  exitApp: vi.fn(),
}));

// Mock file operations while keeping schema functions
vi.mock('../../src/services/configuration.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../src/services/configuration.js')
    >();
  return {
    ...actual,
    saveConfig: vi.fn(),
    loadConfig: vi.fn(() => ({})),
  };
});

// Mock execution validator
vi.mock('../../src/services/execution-validator.js', () => ({
  validateExecuteTasks: vi.fn(() => []),
}));

describe('Execution handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Config task execution', () => {
    it('creates config definition when all tasks are config type', () => {
      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Configure settings',
            tasks: [
              {
                action: 'Configure API key',
                type: TaskType.Config,
                params: { key: 'anthropic.key' },
              },
              {
                action: 'Configure model',
                type: TaskType.Config,
                params: { key: 'anthropic.model' },
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(), // handleIntrospectError
        vi.fn(), // handleIntrospectComplete
        vi.fn(), // handleIntrospectAborted
        vi.fn(), // handleAnswerError
        vi.fn(), // handleAnswerComplete
        vi.fn(), // handleAnswerAborted
        vi.fn(), // handleExecuteError
        vi.fn(), // handleExecuteComplete
        vi.fn(), // handleExecuteAborted
        setQueue
      );

      // Create confirm component in queue
      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: {
          message: 'Execute?',
          onConfirmed: vi.fn(),
          onCancelled: vi.fn(),
        },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Should return array with Config definition
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(ComponentName.Config);

      // Confirm should be marked as done in timeline
      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const markedConfirm = addToTimeline.mock
        .calls[0][0] as StatefulComponentDefinition;
      expect(markedConfirm.state.done).toBe(true);
    });

    it('extracts config keys from task params', () => {
      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Configure',
            tasks: [
              {
                action: 'Configure key',
                type: TaskType.Config,
                params: { key: 'anthropic.key' },
              },
              {
                action: 'Configure debug',
                type: TaskType.Config,
                params: { key: 'settings.debug' },
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        setQueue
      );

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Config component should have steps generated from keys
      expect(result[0].name).toBe(ComponentName.Config);
      const configProps = result[0].props as ConfigProps;
      expect(configProps.steps).toBeDefined();
      expect(configProps.steps.length).toBe(2);
    });

    it('filters out tasks without key param', () => {
      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Configure',
            tasks: [
              {
                action: 'Configure key',
                type: TaskType.Config,
                params: { key: 'anthropic.key' },
              },
              {
                action: 'Invalid config',
                type: TaskType.Config,
                // Missing key param
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        setQueue
      );

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Should only have one step from the valid key
      const configProps = result[0].props as ConfigProps;
      expect(configProps.steps.length).toBe(1);
    });

    it('wraps config handlers with setQueue for proper queue management', () => {
      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Configure',
            tasks: [
              {
                action: 'Configure key',
                type: TaskType.Config,
                params: { key: 'anthropic.key' },
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        setQueue
      );

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Config component should have onFinished and onAborted handlers
      const configProps = result[0].props as ConfigProps;
      expect(configProps.onFinished).toBeDefined();
      expect(configProps.onAborted).toBeDefined();

      // When onFinished is called, it should call setQueue
      if (configProps.onFinished) {
        configProps.onFinished({ key: 'test-value' });
      }
      expect(setQueue).toHaveBeenCalled();
    });

    it('does not create config for mixed task types', () => {
      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Mixed tasks',
            tasks: [
              {
                action: 'Configure key',
                type: TaskType.Config,
                params: { key: 'anthropic.key' },
              },
              {
                action: 'Execute something',
                type: TaskType.Execute,
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        setQueue
      );

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Should not create Config component for mixed types
      // Currently falls through to regular execution (exits)
      expect(result).toEqual([]);
    });
  });

  describe('Execute task validation', () => {
    it('shows feedback and exits when config is missing', async () => {
      const { validateExecuteTasks } = await import(
        '../../src/services/execution-validator.js'
      );

      // Mock validateExecuteTasks to return missing config
      vi.mocked(validateExecuteTasks).mockReturnValueOnce([
        {
          path: 'project.alpha.path',
          type: 'string',
          description: 'Project Alpha Path',
        },
        {
          path: 'project.alpha.enabled',
          type: 'boolean',
          description: 'Project Alpha Enabled',
        },
      ]);

      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Execute build',
            tasks: [
              {
                action: 'Build project alpha',
                type: TaskType.Execute,
                params: { skill: 'Build Project', variant: 'alpha' },
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        setQueue
      );

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Should return empty array (validation failed)
      expect(result).toEqual([]);

      // Should add Feedback component to timeline
      expect(addToTimeline).toHaveBeenCalledTimes(2);

      // First call: mark confirm as done
      const markedConfirm = addToTimeline.mock
        .calls[0][0] as StatefulComponentDefinition;
      expect(markedConfirm.state.done).toBe(true);

      // Second call: add Feedback with Aborted type
      const feedback = addToTimeline.mock.calls[1][0] as ComponentDefinition;
      expect(feedback.name).toBe(ComponentName.Feedback);
      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Aborted);

      // Message should list missing config
      expect(feedbackProps.message).toContain('Missing required configuration');
      expect(feedbackProps.message).toContain('Project Alpha Path');
      expect(feedbackProps.message).toContain('Project Alpha Enabled');

      // Should exit with code 1
      expect(exitApp).toHaveBeenCalledWith(1);
    });

    it('executes normally when config is present', async () => {
      const { validateExecuteTasks } = await import(
        '../../src/services/execution-validator.js'
      );

      // Mock validateExecuteTasks to return no missing config
      vi.mocked(validateExecuteTasks).mockReturnValueOnce([]);

      const timeline: ComponentDefinition[] = [
        {
          id: 'plan-1',
          name: ComponentName.Plan,
          state: {
            done: true,
            highlightedIndex: null,
            currentDefineGroupIndex: 0,
            completedSelections: [],
          },
          props: {
            message: 'Execute build',
            tasks: [
              {
                action: 'Build project alpha',
                type: TaskType.Execute,
                params: { skill: 'Build Project', variant: 'alpha' },
              },
            ],
            onAborted: vi.fn(),
          },
        },
      ];

      const timelineRef = { current: timeline };
      const addToTimeline = vi.fn();
      const setQueue = vi.fn();
      const mockService = {} as unknown as LLMService;

      const handler = createExecutionConfirmedHandler(
        timelineRef,
        addToTimeline,
        mockService,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(), // handleExecuteError
        vi.fn(), // handleExecuteComplete
        vi.fn(), // handleExecuteAborted
        setQueue
      );

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      const queueHandler = handler();
      const result = queueHandler([confirmComponent]);

      // Should return Execute component
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(ComponentName.Execute);

      // Should mark confirm as done
      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const markedConfirm = addToTimeline.mock
        .calls[0][0] as StatefulComponentDefinition;
      expect(markedConfirm.state.done).toBe(true);

      // Should not exit
      expect(exitApp).not.toHaveBeenCalled();
    });
  });
});
