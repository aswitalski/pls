import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigRequirement } from '../../src/types/skills.js';
import { Task, TaskType } from '../../src/types/types.js';

import { Validate } from '../../src/ui/Validate.js';

import { createMockAnthropicService, Keys } from '../test-utils.js';

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
            action: 'Product Alpha path',
            params: { key: 'product.alpha.path' },
          },
        ],
      });

      const { lastFrame } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="build alpha"
          state={{ done: true }}
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
        { timeout: 2000 }
      );
    });

    it('displays completion message', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
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
        { timeout: 2000 }
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
          action: 'Product Alpha path',
          params: { key: 'product.alpha.path' },
        },
        {
          type: TaskType.Config,
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
        { timeout: 2000 }
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
          action: 'Product Alpha path',
          params: { key: 'product.alpha.path' },
        },
        {
          type: TaskType.Config,
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
        { timeout: 2000 }
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
        />
      );

      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalledWith(errorMessage);
        },
        { timeout: 2000 }
      );
    });

    it('shows error message when no service available', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const { lastFrame } = render(
        <Validate
          missingConfig={missingConfig}
          userRequest="setup"
          service={undefined}
          onComplete={vi.fn()}
          onError={vi.fn()}
          onAborted={vi.fn()}
        />
      );

      await vi.waitFor(() => {
        expect(lastFrame()).toContain('Error: No service available');
      });
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
        />
      );

      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalled();
    });
  });

  describe('Minimum processing time', () => {
    it('respects minimum processing time', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'api.key', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
          action: 'API Key',
          params: { key: 'api.key' },
        },
      ];

      const service = createMockAnthropicService({ tasks });
      const onComplete = vi.fn();

      const startTime = Date.now();

      render(
        <Validate
          missingConfig={missingConfig}
          userRequest="quick setup"
          service={service}
          onComplete={onComplete}
          onError={vi.fn()}
          onAborted={vi.fn()}
        />
      );

      await vi.waitFor(
        () => {
          expect(onComplete).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(1000);
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
        { timeout: 2000 }
      );
    });

    it('handles unknown keys with default string type', async () => {
      const missingConfig: ConfigRequirement[] = [
        { path: 'known.key', type: 'string' },
      ];

      const tasks: Task[] = [
        {
          type: TaskType.Config,
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
        { timeout: 2000 }
      );
    });
  });
});
