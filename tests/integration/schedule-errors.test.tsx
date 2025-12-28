import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../src/configuration/io.js';
import { toolRegistry } from '../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../src/services/skills.js';
import { TaskType } from '../../src/types/types.js';
import type { ScheduledTask } from '../../src/types/types.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderBasePrompt,
  renderCompactPrompt,
  renderResponse,
} from '../tools/schedule-test-helpers.js';

describe('Error handling and edge cases', () => {
  it(
    'handles requests with no matching skills gracefully',
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

      // Provide no skills
      const baseInstructions = toolRegistry.getInstructions('schedule');

      renderBasePrompt(baseInstructions);

      // Request something that would need a skill
      const userCommand = 'compile the project';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        baseInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, []);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // Should create ignore type task for unmatched verb
      expect(leafTasks.length).toBe(1);
      expect(leafTasks[0].type).toBe('ignore');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles ambiguous requests appropriately',
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

      const baseInstructions = toolRegistry.getInstructions('schedule');

      renderBasePrompt(baseInstructions);

      // Vague request
      const userCommand = 'do something';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        baseInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, []);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // Should create ignore type for vague request
      expect(leafTasks.length).toBe(1);
      expect(leafTasks[0].type).toBe('ignore');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'preserves sequence for mixed valid and invalid requests',
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

      const skills = loadTestSkills(['navigate-to-project.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      // Mix of valid skill and invalid operation
      const userCommand = 'navigate to alpha and reticulate splines';

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
      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 2 leaf tasks (navigate + ignore for "reticulate splines")
      expect(leafTasks.length).toBe(2);

      // First should be execute (navigate)
      const executeTask = leafTasks.find(
        (task) => task.type === TaskType.Execute
      );
      expect(executeTask).toBeDefined();

      // Should also have ignore for "reticulate splines"
      const ignoreTask = leafTasks.find(
        (task) => task.type === TaskType.Ignore
      );
      expect(ignoreTask).toBeDefined();
      expect(ignoreTask?.action).toMatch(/reticulate|spline/i);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'ensures all leaf tasks have type field',
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

      // Complex request with multiple operations
      const userCommand =
        'explain docker, build alpha, navigate to beta, list skills';

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
      const leafTasks = getAllLeafTasks(tasks);

      // CRITICAL: Every single leaf task must have a type field
      // Expected: 1 answer + 3 build + 1 navigate + 1 introspect = 6 tasks
      expect(leafTasks.length).toBe(6);
      leafTasks.forEach((task) => {
        expect(task.type).toBeDefined();
        expect(task.type).toBeTruthy();
        expect(task.action).toBeTruthy();
      });
    },
    LLM_TEST_TIMEOUT
  );
});
