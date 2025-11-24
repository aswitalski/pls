import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  ConfigProps,
  FeedbackProps,
  StatefulComponentDefinition,
} from '../../src/types/components.js';
import { HandlerOperations, SetQueue } from '../../src/types/handlers.js';
import {
  ComponentName,
  FeedbackType,
  Task,
  TaskType,
} from '../../src/types/types.js';

import { LLMService } from '../../src/services/anthropic.js';
import { createExecutionHandlers } from '../../src/handlers/execution.js';

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
  let ops: HandlerOperations;
  let addToTimelineMock: ReturnType<typeof vi.fn>;
  let setQueueMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addToTimelineMock = vi.fn();
    setQueueMock = vi.fn(
      (updater: (queue: ComponentDefinition[]) => ComponentDefinition[]) => {
        return updater;
      }
    );
  });

  const getQueueUpdater = () =>
    setQueueMock.mock.calls[0][0] as (
      queue: ComponentDefinition[]
    ) => ComponentDefinition[];
  const getTimelineArgs = () =>
    addToTimelineMock.mock.calls[0] as ComponentDefinition[];

  describe('Config task execution', () => {
    it('creates config definition when all tasks are config type', () => {
      const tasks = [
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
      ];

      const mockService = {} as unknown as LLMService;
      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

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

      handlers.onConfirmed(tasks);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([confirmComponent]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(ComponentName.Config);

      expect(addToTimelineMock).toHaveBeenCalledTimes(1);
      const markedConfirm = getTimelineArgs()[0] as StatefulComponentDefinition;
      expect(markedConfirm.state.done).toBe(true);
    });

    it('extracts config keys from task params', () => {
      const tasks = [
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
      ];

      const mockService = {} as unknown as LLMService;
      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      handlers.onConfirmed(tasks);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([confirmComponent]);

      expect(result[0].name).toBe(ComponentName.Config);
      const configProps = result[0].props as ConfigProps;
      expect(configProps.steps).toBeDefined();
      expect(configProps.steps.length).toBe(2);
    });

    it('filters out tasks without key param', () => {
      const tasks = [
        {
          action: 'Configure key',
          type: TaskType.Config,
          params: { key: 'anthropic.key' },
        },
        {
          action: 'Invalid config',
          type: TaskType.Config,
        },
      ];

      const mockService = {} as unknown as LLMService;
      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      handlers.onConfirmed(tasks);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([confirmComponent]);

      const configProps = result[0].props as ConfigProps;
      expect(configProps.steps.length).toBe(1);
    });

    it('wraps config handlers with setQueue for proper queue management', () => {
      const tasks = [
        {
          action: 'Configure key',
          type: TaskType.Config,
          params: { key: 'anthropic.key' },
        },
      ];

      const mockService = {} as unknown as LLMService;
      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      handlers.onConfirmed(tasks);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([confirmComponent]);

      const configProps = result[0].props as ConfigProps;
      expect(configProps.onFinished).toBeDefined();
      expect(configProps.onAborted).toBeDefined();

      if (configProps.onFinished) {
        configProps.onFinished({ key: 'test-value' });
      }
      expect(setQueueMock).toHaveBeenCalledTimes(2);
    });

    it('does not create config for mixed task types', () => {
      const tasks = [
        {
          action: 'Configure key',
          type: TaskType.Config,
          params: { key: 'anthropic.key' },
        },
        {
          action: 'Execute something',
          type: TaskType.Execute,
        },
      ];

      const mockService = {} as unknown as LLMService;
      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      handlers.onConfirmed(tasks);

      const queueUpdater = getQueueUpdater();
      const result = queueUpdater([confirmComponent]);

      expect(result).toEqual([]);
    });
  });

  describe('Execute task with missing config', () => {
    it('continues execution after config is provided', async () => {
      const { validateExecuteTasks } = await import(
        '../../src/services/execution-validator.js'
      );
      const { saveConfig } = await import(
        '../../src/services/configuration.js'
      );

      // First call: return missing config
      // Subsequent calls: return no missing config (after config is saved)
      let validateCallCount = 0;
      vi.mocked(validateExecuteTasks).mockImplementation(() => {
        validateCallCount++;
        if (validateCallCount === 1) {
          return [{ path: 'product.alpha.path', type: 'string' }];
        }
        return [];
      });

      const tasks = [
        {
          action: 'Build {product.alpha.path}',
          type: TaskType.Execute,
          params: { skill: 'build-product', variant: 'alpha' },
        },
      ];

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          requirements: [
            {
              path: 'product.alpha.path',
              description: 'Product Alpha build path',
            },
          ],
        }),
      } as unknown as LLMService;

      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      // Step 1: User confirms execution
      handlers.onConfirmed(tasks);

      const queueUpdater1 = setQueueMock.mock.calls[0][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result1 = queueUpdater1([confirmComponent]);

      // Should create VALIDATE component to get descriptions
      expect(result1).toHaveLength(1);
      expect(result1[0].name).toBe(ComponentName.Validate);

      // Step 2: Simulate VALIDATE completion
      const validateComponent = result1[0];
      if (!('props' in validateComponent)) {
        throw new Error('Validate component has no props');
      }
      const validateProps = validateComponent.props as {
        onComplete?: (
          requirements: { path: string; description: string }[]
        ) => void;
      };

      expect(validateProps.onComplete).toBeDefined();
      validateProps.onComplete?.([
        { path: 'product.alpha.path', description: 'Product Alpha path' },
      ]);

      // Step 3: After VALIDATE completes, should create CONFIG component
      const queueUpdater2 = setQueueMock.mock.calls[1][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result2 = queueUpdater2([validateComponent]);

      expect(result2).toHaveLength(1);
      expect(result2[0].name).toBe(ComponentName.Config);

      // Step 4: Simulate user providing config values
      const configComponent = result2[0];
      if (!('props' in configComponent)) {
        throw new Error('Config component has no props');
      }
      const configProps = configComponent.props as {
        onFinished?: (config: Record<string, string>) => void;
      };

      expect(configProps.onFinished).toBeDefined();
      configProps.onFinished?.({ path: '/data/products/alpha' });

      // Step 5: After CONFIG completes, should create EXECUTE component
      const queueUpdater3 = setQueueMock.mock.calls[2][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result3 = queueUpdater3([configComponent]);

      // Verify config was saved
      expect(saveConfig).toHaveBeenCalledWith('product', {
        alpha: { path: '/data/products/alpha' },
      });

      // Verify EXECUTE component was created with original tasks
      expect(result3).toHaveLength(1);
      expect(result3[0].name).toBe(ComponentName.Execute);
      const executeProps = result3[0].props as { tasks?: Task[] };
      expect(executeProps.tasks).toEqual(tasks);
    });

    it('handles multiple missing config values', async () => {
      const { validateExecuteTasks } = await import(
        '../../src/services/execution-validator.js'
      );
      const { saveConfig } = await import(
        '../../src/services/configuration.js'
      );

      vi.mocked(validateExecuteTasks).mockReturnValue([
        { path: 'product.alpha.path', type: 'string' },
        { path: 'product.alpha.port', type: 'number' },
        { path: 'settings.debug', type: 'boolean' },
      ]);

      const tasks = [
        {
          action: 'Start alpha server',
          type: TaskType.Execute,
          params: { skill: 'start-server', variant: 'alpha' },
        },
      ];

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          requirements: [
            { path: 'product.alpha.path', description: 'Alpha server path' },
            { path: 'product.alpha.port', description: 'Alpha server port' },
            { path: 'settings.debug', description: 'Debug mode' },
          ],
        }),
      } as unknown as LLMService;

      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      handlers.onConfirmed(tasks);

      const queueUpdater1 = setQueueMock.mock.calls[0][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result1 = queueUpdater1([confirmComponent]);

      expect(result1[0].name).toBe(ComponentName.Validate);

      // Simulate VALIDATE completion
      const validateComponent = result1[0];
      const validateProps = validateComponent.props as {
        onComplete?: (
          requirements: { path: string; description: string }[]
        ) => void;
      };

      validateProps.onComplete?.([
        { path: 'product.alpha.path', description: 'Alpha server path' },
        { path: 'product.alpha.port', description: 'Alpha server port' },
        { path: 'settings.debug', description: 'Debug mode' },
      ]);

      // Get CONFIG component
      const queueUpdater2 = setQueueMock.mock.calls[1][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result2 = queueUpdater2([validateComponent]);

      expect(result2[0].name).toBe(ComponentName.Config);

      // Verify CONFIG has 3 steps
      const configComponent = result2[0];
      const configProps = configComponent.props as {
        steps?: unknown[];
        onFinished?: (config: Record<string, string>) => void;
      };

      expect(configProps.steps).toHaveLength(3);

      // User provides all values
      configProps.onFinished?.({
        path: '/opt/alpha',
        port: '8080',
        debug: 'true',
      });

      const queueUpdater3 = setQueueMock.mock.calls[2][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result3 = queueUpdater3([configComponent]);

      // Verify multiple sections were saved
      expect(saveConfig).toHaveBeenCalledWith('product', {
        alpha: { path: '/opt/alpha', port: '8080' },
      });
      expect(saveConfig).toHaveBeenCalledWith('settings', {
        debug: 'true',
      });

      // Verify EXECUTE component was created
      expect(result3[0].name).toBe(ComponentName.Execute);
    });

    it('does not execute when config is aborted', async () => {
      const { validateExecuteTasks } = await import(
        '../../src/services/execution-validator.js'
      );
      const { exitApp } = await import('../../src/services/process.js');

      vi.mocked(validateExecuteTasks).mockReturnValue([
        { path: 'product.alpha.path', type: 'string' },
      ]);

      const tasks = [
        {
          action: 'Build {product.alpha.path}',
          type: TaskType.Execute,
          params: { skill: 'build-product', variant: 'alpha' },
        },
      ];

      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          requirements: [
            { path: 'product.alpha.path', description: 'Product Alpha path' },
          ],
        }),
      } as unknown as LLMService;

      ops = {
        addToTimeline: addToTimelineMock as (
          ...items: ComponentDefinition[]
        ) => void,
        setQueue: setQueueMock as unknown as SetQueue,
        service: mockService,
      };

      const taskHandlers = {
        introspect: {
          onError: vi.fn(),
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        answer: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
        execute: { onError: vi.fn(), onComplete: vi.fn(), onAborted: vi.fn() },
      };

      const handlers = createExecutionHandlers(ops, taskHandlers);

      const confirmComponent: ComponentDefinition = {
        id: 'confirm-1',
        name: ComponentName.Confirm,
        state: { done: false },
        props: { message: 'Execute?' },
      };

      handlers.onConfirmed(tasks);

      const queueUpdater1 = setQueueMock.mock.calls[0][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result1 = queueUpdater1([confirmComponent]);

      // Simulate VALIDATE completion
      const validateComponent = result1[0];
      const validateProps = validateComponent.props as {
        onComplete?: (
          requirements: { path: string; description: string }[]
        ) => void;
      };

      validateProps.onComplete?.([
        { path: 'product.alpha.path', description: 'Product Alpha path' },
      ]);

      // Get CONFIG component
      const queueUpdater2 = setQueueMock.mock.calls[1][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result2 = queueUpdater2([validateComponent]);

      expect(result2[0].name).toBe(ComponentName.Config);

      // User aborts config
      const configComponent = result2[0];
      const configProps = configComponent.props as {
        onAborted?: () => void;
      };

      configProps.onAborted?.();

      const queueUpdater3 = setQueueMock.mock.calls[2][0] as (
        queue: ComponentDefinition[]
      ) => ComponentDefinition[];
      const result3 = queueUpdater3([configComponent]);

      // Should add aborted feedback to timeline
      expect(addToTimelineMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: ComponentName.Config,
          state: { done: true },
        }) as ComponentDefinition,
        expect.objectContaining({
          name: ComponentName.Feedback,
          props: expect.objectContaining({
            type: FeedbackType.Aborted,
          }) as FeedbackProps,
        }) as ComponentDefinition
      );

      // Should exit and NOT create EXECUTE component
      expect(exitApp).toHaveBeenCalledWith(0);
      expect(result3).toEqual([]);
    });
  });
});
