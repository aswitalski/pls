import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../src/configuration/io.js';
import { toolRegistry } from '../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../src/services/skills.js';
import type { ScheduledTask } from '../../src/types/types.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderBasePrompt,
  renderCompactPrompt,
  renderResponse,
} from '../tools/schedule-test-helpers.js';

function getMaxDepth(tasks: ScheduledTask[]): number {
  let maxDepth = 1;

  function traverse(task: ScheduledTask, depth: number) {
    maxDepth = Math.max(maxDepth, depth);
    if (task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        traverse(subtask, depth + 1);
      }
    }
  }

  for (const task of tasks) {
    traverse(task, 1);
  }

  return maxDepth;
}

describe('Task hierarchy', () => {
  it(
    'creates appropriate hierarchy for complex workflows',
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

      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      // Complex multi-step workflow
      const userCommand = 'build alpha and beta projects';

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

      // Should have exactly 2 levels of hierarchy (group -> leaf tasks)
      const maxDepth = getMaxDepth(tasks);
      expect(maxDepth).toBe(2);

      // Verify all leaf tasks have type field
      const leafTasks = getAllLeafTasks(tasks);
      leafTasks.forEach((task) => {
        expect(task.type).toBeDefined();
      });
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'maintains logical grouping in hierarchy',
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

      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      const userCommand = 'build gamma variant';

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
      expect(tasks.length).toBe(1); // Single "Build gamma" task

      // Verify hierarchy exists and is logical
      const leafTasks = getAllLeafTasks(tasks);
      expect(leafTasks.length).toBe(3); // Navigate + Generate + Compile

      // All leaf tasks should have same variant (gamma)
      leafTasks.forEach((task) => {
        if (task.params?.variant) {
          expect(task.params.variant).toBe('gamma');
        }
      });
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'avoids excessive nesting depth',
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

      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      const userCommand = 'build alpha, beta, and gamma';

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

      // Verify depth doesn't exceed max limit (3 levels per spec)
      const maxDepth = getMaxDepth(tasks);
      expect(maxDepth).toBeLessThanOrEqual(3);

      // Verify all leaf tasks have required fields
      const leafTasks = getAllLeafTasks(tasks);
      leafTasks.forEach((task) => {
        expect(task.action).toBeTruthy();
        expect(task.type).toBeDefined();
      });
    },
    LLM_TEST_TIMEOUT
  );
});
