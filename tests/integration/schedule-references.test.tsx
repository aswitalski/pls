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

describe('Skill reference expansion', () => {
  it(
    'resolves skill references to other skills',
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

      // Load both skills - build references navigate
      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once
      renderBasePrompt(baseInstructions);

      // Test skill reference - "build production" should navigate then build
      // "production" maps to "delta" variant per build-project skill
      const userCommand = 'build production';

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
      expect(tasks.length).toBe(1); // Single "Build production" task

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 3 leaf tasks: navigate, generate, compile
      expect(leafTasks.length).toBe(3);

      // Verify all leaf tasks have proper structure
      leafTasks.forEach((task) => {
        expect(task.action).toBeTruthy();
        expect(task.type).toBe('execute');
        expect(task.config).toBeDefined();
        expect(Array.isArray(task.config)).toBe(true);
        expect(task.params).toBeDefined();
        expect(task.params?.skill).toBeDefined();
        expect(task.params?.variant).toBe('delta');
      });

      // Verify config arrays prove skill reference was expanded correctly
      expect(leafTasks[0].config).toEqual(['project.delta.repo']);
      expect(leafTasks[1].config).toEqual([]);
      expect(leafTasks[2].config).toEqual([]);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles circular skill references gracefully',
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

      // Load circular skills - A references B, B references A
      const skills = loadTestSkills([
        'circular-a.skill.md',
        'circular-b.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      const userCommand = 'run circular a';

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

      // Should detect circular reference and handle gracefully
      // Either by creating ignore task or limiting depth
      expect(leafTasks.length).toBeGreaterThan(0);

      // Check if LLM detected the circular reference
      // It should either create ignore task or limit nesting depth
      const ignoreTasks = leafTasks.filter(
        (task) => task.type === TaskType.Ignore
      );
      const executeTasks = leafTasks.filter(
        (task) => task.type === TaskType.Execute
      );

      // Either has ignore task OR limited execute tasks (not infinite)
      if (ignoreTasks.length > 0) {
        // LLM detected circular reference and created ignore task
        expect(ignoreTasks[0].action).toMatch(/circular|unknown|ignore/i);
      } else {
        // LLM expanded but should have stopped at max 3 levels
        expect(executeTasks.length).toBeLessThanOrEqual(6);
      }
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles self-referencing skills gracefully',
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

      // Load self-referencing skill
      const skills = loadTestSkills(['self-reference.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      renderBasePrompt(baseInstructions);

      const userCommand = 'run self reference';

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

      // Should detect self-reference and handle gracefully
      expect(leafTasks.length).toBeGreaterThan(0);

      // Check if LLM detected the self-reference
      const ignoreTasks = leafTasks.filter(
        (task) => task.type === TaskType.Ignore
      );
      const executeTasks = leafTasks.filter(
        (task) => task.type === TaskType.Execute
      );

      // Either has ignore task OR limited execute tasks (not infinite)
      if (ignoreTasks.length > 0) {
        // LLM detected self-reference and created ignore task
        expect(ignoreTasks[0].action).toMatch(/self|circular|unknown|ignore/i);
      } else {
        // LLM expanded but should have stopped at max 3 levels
        expect(executeTasks.length).toBeLessThanOrEqual(3);
      }
    },
    LLM_TEST_TIMEOUT
  );
});
