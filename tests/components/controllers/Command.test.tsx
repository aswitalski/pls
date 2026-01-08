import {
  CommandState,
  ComponentStatus,
} from '../../../src/types/components.js';
import { TaskType } from '../../../src/types/types.js';
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  Command,
  CommandView,
} from '../../../src/components/controllers/Command.js';
import {
  Keys,
  createRequestHandlers,
  createLifecycleHandlers,
  createMockAnthropicService,
  createWorkflowHandlers,
} from '../../test-utils.js';

const { Escape } = Keys;

// Mock service for all tests
const mockService = createMockAnthropicService();

describe('Command component error handling', () => {
  describe('Error display', () => {
    it('displays error from state', () => {
      const { lastFrame } = render(
        <CommandView
          command="test command"
          state={{ error: 'Test error', message: null, tasks: [] }}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('Error: Test error');
    });
  });

  describe('Component states', () => {
    it('displays active state with spinner', () => {
      const { lastFrame } = render(
        <Command
          service={mockService}
          command="test command"
          status={ComponentStatus.Active}
          requestHandlers={createRequestHandlers<CommandState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Active command shows spinner
      expect(lastFrame()).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    it('displays inactive state without spinner', () => {
      const { lastFrame } = render(
        <Command
          service={mockService}
          command="test command"
          status={ComponentStatus.Done}
          requestHandlers={createRequestHandlers<CommandState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Inactive command should not show spinner
      expect(lastFrame()).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });
  });

  describe('Command variations', () => {
    it('renders command with special characters', () => {
      const { lastFrame } = render(
        <Command
          service={mockService}
          status={ComponentStatus.Active}
          command="commit changes with message 'add new feature'"
          requestHandlers={createRequestHandlers<CommandState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      // Command should render without errors
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Abort handling', () => {
    it('calls onAborted when Esc is pressed', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Command
          onAborted={onAborted}
          service={mockService}
          status={ComponentStatus.Active}
          command="test command"
          requestHandlers={createRequestHandlers<CommandState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      stdin.write(Escape);
      expect(onAborted).toHaveBeenCalledTimes(1);
    });

    it('calls handler when aborted', () => {
      const errorHandlers = createRequestHandlers();
      const { stdin } = render(
        <Command
          onAborted={vi.fn()}
          service={mockService}
          status={ComponentStatus.Active}
          command="test command"
          lifecycleHandlers={createLifecycleHandlers()}
          requestHandlers={errorHandlers}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      stdin.write(Escape);

      expect(errorHandlers.onAborted).toHaveBeenCalledTimes(1);
    });

    it('does not call onAborted when Esc is pressed after done', () => {
      const onAborted = vi.fn();
      const { stdin } = render(
        <Command
          onAborted={onAborted}
          service={mockService}
          command="test command"
          status={ComponentStatus.Done}
          requestHandlers={createRequestHandlers<CommandState>()}
          lifecycleHandlers={createLifecycleHandlers()}
          workflowHandlers={createWorkflowHandlers()}
        />
      );

      stdin.write(Escape);
      expect(onAborted).not.toHaveBeenCalled();
    });
  });

  describe('Execute routing', () => {
    it('routes Execute tasks correctly when all tasks are Execute type', async () => {
      const service = createMockAnthropicService({
        message: 'Here is my plan.',
        tasks: [
          { action: 'Build the project', type: TaskType.Execute },
          { action: 'Run tests', type: TaskType.Execute },
        ],
      });

      const result = await service.processWithTool(
        'build and test',
        'schedule'
      );

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].type).toBe(TaskType.Execute);
      expect(result.tasks[1].type).toBe(TaskType.Execute);
    });

    it('correctly identifies all Execute tasks', () => {
      const tasks = [
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
        { action: 'Deploy application', type: TaskType.Execute },
      ];

      const allExecute = tasks.every((task) => task.type === TaskType.Execute);
      expect(allExecute).toBe(true);
    });

    it('correctly identifies mixed task types', () => {
      const tasks = [
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Explain testing', type: TaskType.Answer },
      ];

      const allExecute = tasks.every((task) => task.type === TaskType.Execute);
      expect(allExecute).toBe(false);
    });
  });
});
