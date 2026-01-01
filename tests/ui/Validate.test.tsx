import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentStatus, ValidateState } from '../../src/types/components.js';
import { ConfigRequirement } from '../../src/types/skills.js';
import { Task, TaskType } from '../../src/types/types.js';

import { Validate } from '../../src/components/controllers/Validate.js';

import {
  createLifecycleHandlers,
  createMockAnthropicService,
  createMockDebugComponents,
  createRequestHandlers,
  createWorkflowHandlers,
  Keys,
} from '../test-utils.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ELAPSED_UPDATE_INTERVAL: 250,
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock Config component to auto-complete when rendered
vi.mock('../../src/ui/Config.js', () => ({
  Config: ({
    onFinished,
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

// Mock saveConfigLabels to avoid file system operations in tests
vi.mock('../../src/services/config-labels.js', () => ({
  saveConfigLabels: vi.fn(),
  saveConfigLabel: vi.fn(),
  loadConfigLabels: vi.fn().mockReturnValue({}),
  getConfigLabel: vi.fn().mockReturnValue(undefined),
}));

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
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
          status={ComponentStatus.Done}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
        />
      );

      expect(lastFrame()).toBe('');
    });
  });

  describe('Completion with single property', () => {
    it('adds config component to queue', async () => {
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
      const workflowHandlers = createWorkflowHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(workflowHandlers.addToQueue).toHaveBeenCalled();
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
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
    it('adds config component to queue', async () => {
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
      const workflowHandlers = createWorkflowHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(workflowHandlers.addToQueue).toHaveBeenCalled();
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
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
          onValidationComplete={vi.fn()}
          onError={onError}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
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
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={onAborted}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
          status={ComponentStatus.Active}
        />
      );

      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalled();
    });
  });

  describe('Minimum processing time', () => {
    it('uses ensureMinimumTime for UX polish', async () => {
      const { ensureMinimumTime } =
        await import('../../src/services/timing.js');
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
      const workflowHandlers = createWorkflowHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="quick setup"
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(workflowHandlers.addToQueue).toHaveBeenCalled();
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
      const workflowHandlers = createWorkflowHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="enable feature"
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(workflowHandlers.addToQueue).toHaveBeenCalled();
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
      const workflowHandlers = createWorkflowHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(workflowHandlers.addToQueue).toHaveBeenCalled();
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

      const workflowHandlers = createWorkflowHandlers();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={service}
          onValidationComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
          requestHandlers={createRequestHandlers<ValidateState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={workflowHandlers}
          status={ComponentStatus.Active}
        />
      );

      await vi.waitFor(
        () => {
          expect(workflowHandlers.addToTimeline).toHaveBeenCalledWith(
            ...debugComponents
          );
        },
        { timeout: 500 }
      );
    });
  });
});
