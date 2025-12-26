import { describe, expect, it, vi } from 'vitest';

import { AnthropicService } from '../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../src/services/configuration.js';
import { toolRegistry } from '../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../src/services/skills.js';
import { handleRefinement } from '../../src/services/refinement.js';
import { TaskType } from '../../src/types/types.js';
import type { ScheduledTask, Task } from '../../src/types/types.js';
import type {
  QueueHandlers,
  LifecycleHandlers,
  WorkflowHandlers,
  ErrorHandlers,
} from '../../src/types/handlers.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderBasePrompt,
  renderCompactPrompt,
  renderResponse,
} from '../tools/schedule-test-helpers.js';

describe('Define task flow', () => {
  it(
    'creates define task for ambiguous requests with proper options',
    async () => {
      if (!hasValidAnthropicKey()) {
        console.log(
          'Skipping LLM test: No valid Anthropic API key in ~/.plsrc'
        );
        return;
      }

      const config = loadConfig();
      const service = new AnthropicService(
        config.anthropic.key,
        config.anthropic.model
      );

      // Load build skill with variants
      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      // Request without specifying which variant is ambiguous
      // Should create DEFINE task with options
      const userCommand = 'build';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      expect(tasks.length).toBe(1); // Single DEFINE task for ambiguous "build"

      // Verify we have exactly 1 DEFINE task
      const leafTasks = getAllLeafTasks(tasks);
      const defineTasks = leafTasks.filter(
        (task) => task.type === TaskType.Define
      ) as Task[];
      expect(defineTasks.length).toBe(1);

      const defineTask = defineTasks[0];
      expect(defineTask.params?.options).toBeDefined();
      expect(Array.isArray(defineTask.params?.options)).toBe(true);

      const options = defineTask.params?.options as string[];
      expect(options.length).toBe(4); // All 4 variants: alpha, beta, gamma, delta

      // Verify options describe different variants
      // Each option should mention a different project variant
      const hasAlpha = options.some((opt) =>
        opt.toLowerCase().includes('alpha')
      );
      const hasBeta = options.some((opt) => opt.toLowerCase().includes('beta'));
      const hasGamma = options.some((opt) =>
        opt.toLowerCase().includes('gamma')
      );
      const hasDelta = options.some((opt) =>
        opt.toLowerCase().includes('delta')
      );

      // Should have all 4 variants in options
      const variantCount = [hasAlpha, hasBeta, hasGamma, hasDelta].filter(
        Boolean
      ).length;
      expect(variantCount).toBe(4);

      // Verify define task has skill reference
      expect(defineTask.params?.skill).toBeDefined();
      expect(defineTask.params?.skill).toBe('Build Project');

      console.log('\n✓ Define task flow verified:');
      console.log('  1. Ambiguous request → DEFINE task created');
      console.log(`  2. Options provided: ${options.length} choices`);
      console.log(`  3. Variants available: ${variantCount}`);
      console.log('  4. Skill reference: Build Project');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'routes define tasks correctly through refinement flow',
    async () => {
      if (!hasValidAnthropicKey()) {
        console.log(
          'Skipping LLM test: No valid Anthropic API key in ~/.plsrc'
        );
        return;
      }

      // Create mock tasks that would come from user selection
      const selectedTasks: Task[] = [
        {
          action: 'Build project Alpha',
          type: 'define' as TaskType,
          params: { skill: 'Build Project', variant: 'alpha' },
          config: [],
        },
      ];

      // Mock handlers
      const queueHandlers: QueueHandlers = {
        addToQueue: vi.fn(),
      };
      const lifecycleHandlers: LifecycleHandlers = {
        completeActive: vi.fn(),
      };
      const workflowHandlers: WorkflowHandlers = {
        completeActiveAndPending: vi.fn(),
        addToTimeline: vi.fn(),
      };
      const errorHandlers: ErrorHandlers = {
        onAborted: vi.fn(),
        onError: vi.fn(),
      };

      const config = loadConfig();
      const service = new AnthropicService(
        config.anthropic.key,
        config.anthropic.model
      );

      // Call handleRefinement with selected tasks
      await handleRefinement(
        selectedTasks,
        service,
        'build',
        queueHandlers,
        lifecycleHandlers,
        workflowHandlers,
        errorHandlers
      );

      // Verify refinement was called correctly
      expect(queueHandlers.addToQueue).toHaveBeenCalled();
      expect(lifecycleHandlers.completeActive).toHaveBeenCalled();

      // Verify schedule component was created
      const queueCalls = (queueHandlers.addToQueue as ReturnType<typeof vi.fn>)
        .mock.calls;

      const hasRefinement = queueCalls.some(
        (call) => call[0]?.name === 'refinement'
      );
      const hasSchedule = queueCalls.some(
        (call) => call[0]?.name === 'schedule'
      );

      expect(hasRefinement).toBe(true);
      expect(hasSchedule).toBe(true);

      console.log('\n✓ Define task routing verified:');
      console.log('  1. Refinement component created');
      console.log('  2. Schedule component created after refinement');
      console.log('  3. Handlers called correctly');
    },
    LLM_TEST_TIMEOUT
  );
});
