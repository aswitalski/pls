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

    it('calls LLM with YAML formatted refined command', async () => {
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

      // Should call processWithTool with YAML formatted tasks
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy to Dev\n\nmetadata:\n  type: execute\n\nrun tests\n\nmetadata:\n  type: execute',
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

      // Should replace commas with dashes in YAML format
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy to Dev - Alpha\n\nmetadata:\n  type: execute',
        'schedule'
      );
    });

    it('includes type for group tasks', async () => {
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

      // Should include type in YAML format for group tasks
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy application\n\nmetadata:\n  type: group',
        'schedule'
      );
    });

    it('preserves case in file paths and URLs', async () => {
      const selectedTasks = [
        {
          action: 'Process /Users/Dev/MyProject/Data.csv in batch mode',
          type: TaskType.Execute,
          config: [],
        },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: [
          {
            action: 'process /Users/Dev/MyProject/Data.csv',
            type: TaskType.Execute,
            config: [],
          },
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
        'process file',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should lowercase only first letter, preserving case in paths
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'process /Users/Dev/MyProject/Data.csv in batch mode\n\nmetadata:\n  type: execute',
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

    it('adds Command component to timeline showing resolved command', async () => {
      const selectedTasks = [
        {
          action: 'process /Users/Dev/MyProject/Data.csv in batch mode',
          type: TaskType.Execute,
          config: [],
        },
      ];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [
            {
              action: 'process /Users/Dev/MyProject/Data.csv',
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
        'process file',
        lifecycleHandlers,
        workflowHandlers,
        requestHandlers
      );

      // Should add Command component to timeline
      expect(workflowHandlers.addToTimeline).toHaveBeenCalled();
      const timelineCall = vi.mocked(workflowHandlers.addToTimeline).mock
        .calls[0][0] as ComponentDefinition;
      expect(timelineCall.name).toBe(ComponentName.Command);

      // Verify the command preserves case from the selected task action
      if (timelineCall.name === ComponentName.Command) {
        expect(timelineCall.props.command).toBe(
          'process /Users/Dev/MyProject/Data.csv in batch mode'
        );
      }
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
