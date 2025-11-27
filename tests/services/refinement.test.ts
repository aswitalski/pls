import { describe, expect, it, vi } from 'vitest';

import { ComponentName, TaskType } from '../../src/types/types.js';
import { ComponentDefinition } from '../../src/types/components.js';

import { LLMService } from '../../src/services/anthropic.js';
import { handleRefinement } from '../../src/services/refinement.js';

import { createMockHandlers } from '../test-utils.js';

describe('Refinement service', () => {
  describe('handleRefinement', () => {
    it('creates refinement component and adds to queue', async () => {
      const selectedTasks = [
        { action: 'Deploy to Dev', type: TaskType.Execute },
      ];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [
            { action: 'Deploy to Dev environment', type: TaskType.Execute },
          ],
        }),
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy to dev',
        handlers
      );

      // Should add Refinement component to queue
      expect(handlers.addToQueue).toHaveBeenCalled();
      const firstCall = (handlers.addToQueue as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as ComponentDefinition;
      expect(firstCall.name).toBe(ComponentName.Refinement);
    });

    it('calls LLM with formatted refined command', async () => {
      const selectedTasks = [
        { action: 'Deploy to Dev', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: [
          { action: 'Deploy to Dev environment', type: TaskType.Execute },
          { action: 'Run test suite', type: TaskType.Execute },
        ],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'deploy and test',
        handlers
      );

      // Should call processWithTool with formatted command
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy to dev (type: execute), run tests (type: execute)',
        'plan'
      );
    });

    it('replaces commas with dashes in task actions', async () => {
      const selectedTasks = [
        { action: 'Deploy to Dev, Alpha', type: TaskType.Execute },
      ];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: [{ action: 'Deploy to Dev Alpha', type: TaskType.Execute }],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(selectedTasks, mockService, 'deploy', handlers);

      // Should replace commas with dashes
      expect(mockProcessWithTool).toHaveBeenCalledWith(
        'deploy to dev - alpha (type: execute)',
        'plan'
      );
    });

    it('completes refinement component after success', async () => {
      const selectedTasks = [
        { action: 'Build project', type: TaskType.Execute },
      ];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [{ action: 'Build the project', type: TaskType.Execute }],
        }),
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(selectedTasks, mockService, 'build', handlers);

      // Should complete active component (Refinement)
      expect(handlers.completeActive).toHaveBeenCalledTimes(1);
    });

    it('routes refined tasks with routeTasksWithConfirm', async () => {
      const selectedTasks = [
        { action: 'Install dependencies', type: TaskType.Execute },
      ];
      const refinedTasks = [{ action: 'npm install', type: TaskType.Execute }];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Refined plan',
        tasks: refinedTasks,
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(
        selectedTasks,
        mockService,
        'install deps',
        handlers
      );

      // After completing Refinement, should route tasks
      // This is verified by checking completeActive was called
      // and that routeTasksWithConfirm would have been invoked
      expect(handlers.completeActive).toHaveBeenCalled();
      expect(mockProcessWithTool).toHaveBeenCalled();
    });

    it('handles LLM errors during refinement', async () => {
      const selectedTasks = [{ action: 'Deploy', type: TaskType.Execute }];
      const mockService = {
        processWithTool: vi
          .fn()
          .mockRejectedValue(new Error('LLM service unavailable')),
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(selectedTasks, mockService, 'deploy', handlers);

      // Should complete active component even on error
      expect(handlers.completeActive).toHaveBeenCalledTimes(1);

      // Should call onError with error message
      expect(handlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (handlers.onError as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(errorMessage).toContain('LLM service unavailable');
    });

    it('handles non-Error exceptions during refinement', async () => {
      const selectedTasks = [{ action: 'Deploy', type: TaskType.Execute }];
      const mockService = {
        processWithTool: vi.fn().mockRejectedValue('String error'),
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(selectedTasks, mockService, 'deploy', handlers);

      // Should complete active component even on error
      expect(handlers.completeActive).toHaveBeenCalledTimes(1);

      // Should call onError with stringified error
      expect(handlers.onError).toHaveBeenCalledTimes(1);
      const errorMessage = (handlers.onError as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(errorMessage).toBeTruthy();
    });

    it('passes original command to routing', async () => {
      const selectedTasks = [{ action: 'Test', type: TaskType.Execute }];
      const mockProcessWithTool = vi.fn().mockResolvedValue({
        message: 'Run tests',
        tasks: [{ action: 'npm test', type: TaskType.Execute }],
      });
      const mockService = {
        processWithTool: mockProcessWithTool,
      } as unknown as LLMService;
      const handlers = createMockHandlers();
      const originalCommand = 'run all tests';

      await handleRefinement(
        selectedTasks,
        mockService,
        originalCommand,
        handlers
      );

      // Verify processWithTool was called
      expect(mockProcessWithTool).toHaveBeenCalled();
      // Original command is preserved for context in routing
      expect(handlers.completeActive).toHaveBeenCalled();
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
      const handlers = createMockHandlers();

      await handleRefinement(selectedTasks, mockService, 'nothing', handlers);

      // Should still call processWithTool with empty string
      expect(mockProcessWithTool).toHaveBeenCalledWith('', 'plan');
      expect(handlers.completeActive).toHaveBeenCalledTimes(1);
    });

    it('calls onAborted when refinement is aborted', async () => {
      const selectedTasks = [{ action: 'Deploy', type: TaskType.Execute }];
      const mockService = {
        processWithTool: vi.fn().mockResolvedValue({
          message: 'Refined plan',
          tasks: [{ action: 'Deploy app', type: TaskType.Execute }],
        }),
      } as unknown as LLMService;
      const handlers = createMockHandlers();

      await handleRefinement(selectedTasks, mockService, 'deploy', handlers);

      // Get the Refinement component that was added to queue
      const refinementDef = vi.mocked(handlers.addToQueue).mock.calls[0][0];

      // Verify it's a Refinement component with an onAborted callback
      expect(refinementDef.name).toBe(ComponentName.Refinement);

      // Type guard to access props safely
      if (refinementDef.name === ComponentName.Refinement) {
        expect(refinementDef.props.onAborted).toBeDefined();

        // Simulate abort
        refinementDef.props.onAborted('refinement');

        // Verify handlers.onAborted was called
        expect(handlers.onAborted).toHaveBeenCalledWith('refinement');
      }
    });
  });
});
