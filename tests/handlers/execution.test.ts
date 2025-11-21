import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  ConfigProps,
  StatefulComponentDefinition,
} from '../../src/types/components.js';
import { HandlerOperations, SetQueue } from '../../src/types/handlers.js';
import { ComponentName, TaskType } from '../../src/types/types.js';

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
});
