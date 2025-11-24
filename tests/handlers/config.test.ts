import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ComponentDefinition,
  FeedbackProps,
} from '../../src/types/components.js';
import {
  ComponentName,
  FeedbackType,
  TaskType,
} from '../../src/types/types.js';

import {
  createConfigExecutionAbortedHandler,
  createConfigExecutionFinishedHandler,
} from '../../src/handlers/config.js';

// Mock exitApp to prevent actual process exit
vi.mock('../../src/services/process.js', () => ({
  exitApp: vi.fn(),
}));

// Mock saveConfig to capture what's being saved
vi.mock('../../src/services/configuration.js', () => ({
  saveConfig: vi.fn(),
}));

// Import the mocked module to access the mock
import { saveConfig } from '../../src/services/configuration.js';
const mockSaveConfig = vi.mocked(saveConfig);

describe('Config execution handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Config execution finished handler', () => {
    it('saves config values grouped by section', () => {
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key', 'anthropic.model'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);

      const config = {
        key: 'sk-ant-test-key',
        model: 'claude-haiku-4-5-20251001',
      };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
      ];

      const queueHandler = handler(config);
      queueHandler(mockQueue);

      // Verify saveConfig was called with correct values
      expect(mockSaveConfig).toHaveBeenCalledWith('anthropic', {
        key: 'sk-ant-test-key',
        model: 'claude-haiku-4-5-20251001',
      });
    });

    it('marks Config component as done and adds feedback to timeline', () => {
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);

      const config = { key: 'sk-ant-test' };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
      ];

      const queueHandler = handler(config);
      queueHandler(mockQueue);

      // Verify addToTimeline was called with marked-as-done Config and feedback
      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const args = addToTimeline.mock.calls[0] as ComponentDefinition[];
      const markedConfig = args[0];
      const feedback = args[1];

      // Config should be marked as done
      expect(markedConfig.name).toBe(ComponentName.Config);
      expect('state' in markedConfig && markedConfig.state.done).toBe(true);

      // Feedback should be success type
      expect(feedback.name).toBe(ComponentName.Feedback);
      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Succeeded);
      expect(feedbackProps.message).toContain('Configuration complete');
    });

    it('returns remaining queue items', () => {
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);

      const config = { key: 'sk-ant-test' };

      const nextComponent: ComponentDefinition = {
        id: 'next-1',
        name: ComponentName.Message,
        props: { text: 'Next item' },
      };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
        nextComponent,
      ];

      const queueHandler = handler(config);
      const result = queueHandler(mockQueue);

      // Should return rest of queue
      expect(result).toEqual([nextComponent]);
    });

    it('saves multiple sections correctly', () => {
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key', 'settings.debug'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);

      const config = {
        key: 'sk-ant-test',
        debug: 'true',
      };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
      ];

      const queueHandler = handler(config);
      queueHandler(mockQueue);

      // Verify both sections were saved
      expect(mockSaveConfig).toHaveBeenCalledTimes(2);
      expect(mockSaveConfig).toHaveBeenCalledWith('anthropic', {
        key: 'sk-ant-test',
      });
      expect(mockSaveConfig).toHaveBeenCalledWith('settings', {
        debug: 'true',
      });
    });

    it('handles empty queue gracefully', () => {
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);
      const queueHandler = handler({ key: 'test' });

      const result = queueHandler([]);

      expect(result).toEqual([]);
      expect(addToTimeline).not.toHaveBeenCalled();
    });

    it('ignores non-Config components at front of queue', () => {
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);

      const config = { key: 'sk-ant-test' };

      // Put a different component at front
      const mockQueue: ComponentDefinition[] = [
        {
          id: 'message-1',
          name: ComponentName.Message,
          props: { text: 'Not a config' },
        },
      ];

      const queueHandler = handler(config);
      const result = queueHandler(mockQueue);

      // Should return empty since component didn't match
      expect(result).toEqual([]);
      expect(addToTimeline).not.toHaveBeenCalled();
    });

    it('exits without tasks parameter (backward compatibility)', async () => {
      const { exitApp } = await import('../../src/services/process.js');
      const addToTimeline = vi.fn();
      const keys = ['anthropic.key'];

      const handler = createConfigExecutionFinishedHandler(addToTimeline, keys);

      const config = { key: 'sk-ant-test' };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
      ];

      const queueHandler = handler(config);
      queueHandler(mockQueue);

      // Should exit when no tasks provided
      expect(exitApp).toHaveBeenCalledWith(0);
    });

    it('continues with execution when tasks parameter provided', () => {
      const addToTimeline = vi.fn();
      const keys = ['product.alpha.path'];

      const tasks = [
        {
          action: 'Build {product.alpha.path}',
          type: TaskType.Execute,
          params: { skill: 'build-product', variant: 'alpha' },
        },
      ];

      const mockService = {
        processWithTool: vi.fn(),
      };

      const executeHandlers = {
        onError: vi.fn(),
        onComplete: vi.fn(),
        onAborted: vi.fn(),
      };

      const handler = createConfigExecutionFinishedHandler(
        addToTimeline,
        keys,
        tasks,
        mockService,
        executeHandlers
      );

      const config = { path: '/data/products/alpha' };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
      ];

      const queueHandler = handler(config);
      const result = queueHandler(mockQueue);

      // Should create EXECUTE component instead of exiting
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(ComponentName.Execute);
    });
  });

  describe('Config execution aborted handler', () => {
    it('marks Config component as done and adds aborted feedback', () => {
      const addToTimeline = vi.fn();

      const handler = createConfigExecutionAbortedHandler(addToTimeline);

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
      ];

      const queueHandler = handler();
      queueHandler(mockQueue);

      // Verify addToTimeline was called
      expect(addToTimeline).toHaveBeenCalledTimes(1);
      const args = addToTimeline.mock.calls[0] as ComponentDefinition[];
      const markedConfig = args[0];
      const feedback = args[1];

      // Config should be marked as done
      expect(markedConfig.name).toBe(ComponentName.Config);
      expect('state' in markedConfig && markedConfig.state.done).toBe(true);

      // Feedback should be aborted type
      expect(feedback.name).toBe(ComponentName.Feedback);
      const feedbackProps = feedback.props as FeedbackProps;
      expect(feedbackProps.type).toBe(FeedbackType.Aborted);
      expect(feedbackProps.message).toContain('cancelled');
    });

    it('returns remaining queue items', () => {
      const addToTimeline = vi.fn();

      const handler = createConfigExecutionAbortedHandler(addToTimeline);

      const nextComponent: ComponentDefinition = {
        id: 'next-1',
        name: ComponentName.Message,
        props: { text: 'Next item' },
      };

      const mockQueue: ComponentDefinition[] = [
        {
          id: 'config-1',
          name: ComponentName.Config,
          state: { done: false },
          props: { steps: [] },
        },
        nextComponent,
      ];

      const queueHandler = handler();
      const result = queueHandler(mockQueue);

      expect(result).toEqual([nextComponent]);
    });

    it('handles empty queue gracefully', () => {
      const addToTimeline = vi.fn();

      const handler = createConfigExecutionAbortedHandler(addToTimeline);
      const queueHandler = handler();

      const result = queueHandler([]);

      expect(result).toEqual([]);
      expect(addToTimeline).not.toHaveBeenCalled();
    });
  });
});
