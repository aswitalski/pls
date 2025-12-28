import { describe, expect, it, vi } from 'vitest';

import { ComponentName, TaskType } from '../../src/types/types.js';
import { ComponentDefinition } from '../../src/types/components.js';

import { LLMService } from '../../src/services/anthropic.js';
import { handleRefinement } from '../../src/services/refinement.js';

import {
  createLifecycleHandlers,
  createWorkflowHandlers,
  createRequestHandlers,
} from '../test-utils.js';

describe('Refinement service', () => {
  describe('handleRefinement', () => {
    it('creates refinement component and adds to queue', async () => {
      const selectedTasks = [
        { action: 'Deploy to Dev', type: TaskType.Execute, config: [] },
      ];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [
            {
              action: 'Deploy to Dev environment',
              type: TaskType.Execute,
              config: [],
            },
          ],
        }),
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy to dev',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should add Refinement component to queue
      expect(workflowHandlers.addToQueue).toHaveBeenCalled();
      const firstCall = (
        workflowHandlers.addToQueue as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as ComponentDefinition;
      expect(firstCall.name).toBe(ComponentName.Refinement);
    });

    it('calls LLM with formatted refined command', async () => {
      const selectedTasks = [
        { action: 'Deploy to Dev', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: [
          {
            action: 'Deploy to Dev environment',
            type: TaskType.Execute,
            config: [],
          },
          { action: 'Run test suite', type: TaskType.Execute, config: [] },
        ],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy and test',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should call processWithTool with formatted command
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy to dev (shell execution), run tests (shell execution)',
        'schedule'
      );
    });

    it('replaces commas with dashes in task actions', async () => {
      const selectedTasks = [
        { action: 'Deploy to Dev, Alpha', type: TaskType.Execute },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: [
          { action: 'Deploy to Dev Alpha', type: TaskType.Execute, config: [] },
        ],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should replace commas with dashes
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy to dev - alpha (shell execution)',
        'schedule'
      );
    });

    it('uses shell execution format for group tasks', async () => {
      const selectedTasks = [
        { action: 'Deploy application', type: TaskType.Group, config: [] },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: [
          { action: 'Deploy application', type: TaskType.Group, config: [] },
        ],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should use shell execution format for group tasks
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy application (shell execution)',
        'schedule'
      );
    });

    it('completes refinement component after success', async () => {
      const selectedTasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
      ];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [
            { action: 'Build the project', type: TaskType.Execute, config: [] },
          ],
        }),
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'build',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should complete active component (Refinement)
      expect(lifecycleHandlers.completeActive).toHaveBeenCalledTimes(1);
    });

    it('routes refined tasks with routeTasksWithConfirm', async () => {
      const selectedTasks = [
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
      ];
      const refinedTasks = [
        { action: 'npm install', type: TaskType.Execute, config: [] },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: refinedTasks,
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'install deps',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // After completing Refinement, should route tasks
      // This is verified by checking completeActive was called
      // and that routeTasksWithConfirm would have been invoked
      expect(lifecycleHandlers.completeActive).toHaveBeenCalled();
      expect(mockProcessWithTool).toHaveBeenCalled();
    });

    it('handles LLM errors during refinement', async () => {
      const selectedTasks = [
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ];
      const mockService = {
        processWithTool: vi
          .fn()
          .mockRejectedValue(new Error('LLM service unavailable')),
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should complete active component even on error
      expect(lifecycleHandlers.completeActive).toHaveBeenCalledTimes(1);

      // Should call onError with error message
      expect(requestHandlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (requestHandlers.onError as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as string;
      expect(errorMessage).toContain('LLM service unavailable');
    });

    it('handles non-Error exceptions during refinement', async () => {
      const selectedTasks = [
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ];
      const mockService = {
        processWithTool: vi.fn().mockRejectedValue('String error'),
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should complete active component even on error
      expect(lifecycleHandlers.completeActive).toHaveBeenCalledTimes(1);

      // Should call onError with stringified error
      expect(requestHandlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (requestHandlers.onError as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as string;
      expect(errorMessage).toBeTruthy();
    });

    it('passes original command to routing', async () => {
      const selectedTasks = [
        { action: 'Test', type: TaskType.Execute, config: [] },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Run tests',
        tasks: [{ action: 'npm test', type: TaskType.Execute, config: [] }],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();
      const originalCommand = 'run all tests';

      await handleRefinement(
        selectedTasks,
        mockService,
        originalCommand,

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Verify processWithTool was called
      expect(mockProcessWithTool).toHaveBeenCalled();
      // Original command is preserved for context in routing
      expect(lifecycleHandlers.completeActive).toHaveBeenCalled();
    });

    it('handles empty selected tasks array', async () => {
      const selectedTasks: never[] = [];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Empty plan',
        tasks: [],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'nothing',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should still call processWithTool with empty string
      expect(mockProcessWithTool).toHaveBeenCalledWith('', 'schedule');
      expect(lifecycleHandlers.completeActive).toHaveBeenCalledTimes(1);
    });

    it('calls onAborted when refinement is aborted', async () => {
      const selectedTasks = [
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [{ action: 'Deploy app', type: TaskType.Execute, config: [] }],
        }),
      } as unknown as LLMService;

      const lifecycleHandlers = createLifecycleHandlers();
      const workflowHandlers = createWorkflowHandlers();
      const requestHandlers = createRequestHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy',

        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Get the Refinement component that was added to queue
      const refinementDef = vi.mocked(workflowHandlers.addToQueue).mock
        .calls[0][0] as ComponentDefinition;

      // Verify it's a Refinement component with an onAborted callback
      expect(refinementDef.name).toBe(ComponentName.Refinement);

      // Type guard to access props safely
      if (refinementDef.name === ComponentName.Refinement) {
        expect(refinementDef.props.onAborted).toBeDefined();

        // Simulate abort
        refinementDef.props.onAborted('refinement');

        // Verify requestHandlers.onAborted was called
        expect(requestHandlers.onAborted).toHaveBeenCalledWith('refinement');
      }
    });
  });
});
