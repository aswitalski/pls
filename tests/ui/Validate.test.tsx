import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentStatus } from '../../src/types/components.js';
import { ConfigRequirement } from '../../src/types/skills.js';
import { Task, TaskType } from '../../src/types/types.js';

import { Validate } from '../../src/ui/Validate.js';

import {
  createMockAnthropicService,
  createMockDebugComponents,
  createMockHandlers,
  Keys,
} from '../test-utils.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock Config component to auto-complete when rendered
vi.mock('../../src/ui/Config.js', () => ({
  Config: ({
    onFinished,
    steps,
  }: {
    onFinished: (config: Record<string, string>) => void;
    steps: unknown[];
  }) => {
    // Auto-complete the config with mock values
    React.useEffect(() => {
      const config: Record<string, string> = {};
      onFinished(config);
    }, [onFinished]);
    return null;
  },
  StepType: {
    Text: 'text',
    Selection: 'selection',
  },
}));

// Mock saveConfig to avoid file system operations in tests
vi.mock('../../src/services/configuration.js', async () => {
  const actual = await vi.importActual('../../src/services/configuration.js');
  return {
    ...actual,
    saveConfig: vi.fn(),
  };
});

describe('Validate component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading state while validating', () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'product.alpha.path', type: 'string' },
      ];

      const service = createMockAnthropicService({
        tasks: [
          {
            type: TaskType.Config,
            config: [],
            action: 'Product Alpha path',
            params: { key: 'product.alpha.path' },
          },
        ],
      });

      const { lastFrame } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          service={service}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      expect(lastFrame()).toContain('Validating configuration requirements.');
    });

    it('returns null when done with no message', () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'product.alpha.path', type: 'string' },
      ];

      const service = createMockAnthropicService({
        tasks: [
          {
            type: TaskType.Config,
            config: [],
            action: 'Product Alpha path',
            params: { key: 'product.alpha.path' },
          },
        ],
      });

      const { lastFrame } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          state={{}}
          status={ComponentStatus.Done}
          service={service}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
        />
      );

      expect(lastFrame()).toBe('');
    });
  });

  describe('Completion with single property', () => {
    it('calls onComplete with config requirements', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'product.alpha.path', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'Product Alpha path {product.alpha.path}',
          params: { key: 'product.alpha.path' },
        },
      ];

      const service = createMockAnthropicService({ tasks });
      const onComplete = vi.fn();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          service={service}
          onComplete={onComplete}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalledWith([
            {
              path: 'product.alpha.path',
              type: 'string',
              description: 'Product Alpha path {product.alpha.path}',
            },
          ]);
        },
        { timeout: 500 }
      );
    });

    it('displays completion message', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'API Key',
          params: { key: 'api.key' },
        },
      ];

      const service = createMockAnthropicService({ tasks });

      const { lastFrame } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup api"
          service={service}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          const output = lastFrame();
          if (output) {
            // Should show a completion message, not loading state
            expect(output).not.toContain(
              'Validating configuration requirements.'
            );
            expect(output.length).toBeGreaterThan(0);
          }
        },
        { timeout: 500 }
      );
    });
  });

  describe('Completion with multiple properties', () => {
    it('calls onComplete with multiple config requirements', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'product.alpha.path', type: 'string' },
        { path: 'product.alpha.enabled', type: 'boolean' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'Product Alpha path',
          params: { key: 'product.alpha.path' },
        },
        {
          type: TaskType.Config,
          config: [],
          action: 'Product Alpha enabled',
          params: { key: 'product.alpha.enabled' },
        },
      ];

      const service = createMockAnthropicService({ tasks });
      const onComplete = vi.fn();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          service={service}
          onComplete={onComplete}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalledWith([
            {
              path: 'product.alpha.path',
              type: 'string',
              description: 'Product Alpha path',
            },
            {
              path: 'product.alpha.enabled',
              type: 'boolean',
              description: 'Product Alpha enabled',
            },
          ]);
        },
        { timeout: 500 }
      );
    });

    it('displays completion message', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'product.alpha.path', type: 'string' },
        { path: 'product.beta.path', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'Product Alpha path',
          params: { key: 'product.alpha.path' },
        },
        {
          type: TaskType.Config,
          config: [],
          action: 'Product Beta path',
          params: { key: 'product.beta.path' },
        },
      ];

      const service = createMockAnthropicService({ tasks });

      const { lastFrame } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build all"
          service={service}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          const output = lastFrame();
          if (output) {
            // Should show a completion message, not loading state
            expect(output).not.toContain(
              'Validating configuration requirements.'
            );
            expect(output.length).toBeGreaterThan(0);
          }
        },
        { timeout: 500 }
      );
    });
  });

  describe('Error handling', () => {
    it('calls onError when service fails', async () => {
      const errorMessage = 'Network error';
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const service = createMockAnthropicService({}, new Error(errorMessage));
      const onError = vi.fn();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={service}
          onComplete={vi.fn()}
          onError={onError}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalledWith(errorMessage);
        },
        { timeout: 500 }
      );
    });
  });

  describe('Abort handling', () => {
    it('handles escape key to abort', () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const service = createMockAnthropicService({
        tasks: [
          {
            type: TaskType.Config,
            config: [],
            action: 'API Key',
            params: { key: 'api.key' },
          },
        ],
      });

      const onAborted = vi.fn();

      const { stdin } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={service}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={onAborted}
          status={ComponentStatus.Active}
        />
      );

      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalled();
    });
  });

  describe('Minimum processing time', () => {
    it('uses ensureMinimumTime for UX polish', async () => {
      const { ensureMinimumTime } = await import(
        '../../src/services/timing.js'
      );
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'API Key',
          params: { key: 'api.key' },
        },
      ];

      const service = createMockAnthropicService({ tasks });
      const onComplete = vi.fn();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="quick setup"
          service={service}
          onComplete={onComplete}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled();
        },
        { timeout: 500 }
      );

      // Should have called ensureMinimumTime (mocked to return immediately in tests)
      expect(ensureMinimumTime).toHaveBeenCalled();
    });
  });

  describe('Config requirement mapping', () => {
    it('preserves original type from missing config', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'feature.enabled', type: 'boolean' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'Feature enabled',
          params: { key: 'feature.enabled' },
        },
      ];

      const service = createMockAnthropicService({ tasks });
      const onComplete = vi.fn();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="enable feature"
          service={service}
          onComplete={onComplete}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalledWith([
            {
              path: 'feature.enabled',
              type: 'boolean',
              description: 'Feature enabled',
            },
          ]);
        },
        { timeout: 500 }
      );
    });

    it('handles unknown keys with default string type', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'known.key', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          config: [],
          action: 'Unknown setting',
          params: { key: 'unknown.key' },
        },
      ];

      const service = createMockAnthropicService({ tasks });
      const onComplete = vi.fn();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={service}
          onComplete={onComplete}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalledWith([
            {
              path: 'unknown.key',
              type: 'string',
              description: 'Unknown setting',
            },
          ]);
        },
        { timeout: 500 }
      );
    });

    it('adds debug components to timeline', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string', description: 'API Key' },
      ];

      const debugComponents = createMockDebugComponents('validate');

      const tasks: Task[] = [
        {
          action: 'API Key for service',
          type: TaskType.Config,
          params: { key: 'api.key' },
        },
      ];

      const service = createMockAnthropicService({
        tasks,
        debug: debugComponents,
      });

      const handlers = createMockHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={service}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          status={ComponentStatus.Active}
          handlers={handlers}
        />
      );

      await vi.waitFor(
        () => {
          expect(handlers.addToTimeline).toHaveBeenCalledWith(
            ...debugComponents
          );
        },
        { timeout: 500 }
      );
    });
  });
});
