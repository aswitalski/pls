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

describe('Basic task scheduling and message variation', () => {
  it(
    'recognizes skill with different verb variations',
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

      // Load navigation skill
      const skills = loadTestSkills(['navigate-to-project.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once
      renderBasePrompt(baseInstructions);

      // Test different verb variations - specify variant to avoid ambiguity
      const userCommand = 'go to beta repo';

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
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBe(1);

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 1 leaf task
      expect(leafTasks.length).toBe(1);

      // Verify the leaf task structure
      const task = leafTasks[0];
      expect(task.action).toBeTruthy();
      expect(task.type).toBe('execute');

      // Verify skill and variant params
      expect(task.params).toBeDefined();
      expect(task.params?.skill).toBe('Navigate To Project');
      expect(task.params?.variant).toBe('beta');

      // Verify config array contains resolved path
      expect(task.config).toBeDefined();
      expect(Array.isArray(task.config)).toBe(true);
      expect(task.config).toEqual(['project.beta.repo']);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'matches skill variants from natural language',
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

      // Load navigation skill with variants
      const skills = loadTestSkills(['navigate-to-project.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once
      renderBasePrompt(baseInstructions);

      // Test variant matching - LLM should match "experimental" to "beta"
      const userCommand = 'navigate to experimental project';

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
      expect(tasks.length).toBe(1);

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 1 leaf task
      expect(leafTasks.length).toBe(1);

      // Verify the leaf task structure
      const task = leafTasks[0];
      expect(task.action).toBeTruthy();
      expect(task.type).toBe('execute');

      // Verify skill and variant params - "experimental" should map to "beta"
      expect(task.params).toBeDefined();
      expect(task.params?.skill).toBe('Navigate To Project');
      expect(task.params?.variant).toBe('beta');

      // Verify config array contains resolved beta variant path
      expect(task.config).toBeDefined();
      expect(Array.isArray(task.config)).toBe(true);
      expect(task.config).toEqual(['project.beta.repo']);
    },
    LLM_TEST_TIMEOUT
  );
});
