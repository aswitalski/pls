import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../src/services/configuration.js';
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

describe('Variant resolution', () => {
  it(
    'resolves multiple different variant placeholders',
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

      // Load deploy skill with two different variant types
      const skills = loadTestSkills(['deploy-app.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once
      renderBasePrompt(baseInstructions);

      // Test multiple variants - "deploy beta to staging"
      // Should resolve VARIANT=beta and ENV=staging
      const userCommand = 'deploy beta to staging';

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
      expect(tasks.length).toBe(1); // Single "Deploy beta to staging" task

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 3 leaf tasks: cd, git checkout, deploy
      expect(leafTasks.length).toBe(3);

      // Verify all leaf tasks have proper structure
      leafTasks.forEach((task) => {
        expect(task.action).toBeTruthy();
        expect(task.type).toBe('execute');
        expect(task.config).toBeDefined();
        expect(Array.isArray(task.config)).toBe(true);
        expect(task.params).toBeDefined();
        expect(task.params?.skill).toBe('Deploy App');
        expect(task.params?.variant).toBe('beta');
      });

      // Verify exact config arrays for each task
      expect(leafTasks[0].config).toEqual(['project.beta.repo']);
      expect(leafTasks[1].config).toEqual(['project.beta.version']);
      expect(leafTasks[2].config).toEqual([
        'environment.staging.url',
        'environment.staging.token',
      ]);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles multiple variants in parallel',
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

      // Test multiple variants - "build alpha and beta"
      const userCommand = 'build alpha and beta';

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
      expect(tasks.length).toBe(2); // Build alpha + Build beta

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 6 leaf tasks: 3 for alpha + 3 for beta
      expect(leafTasks.length).toBe(6);

      // Verify all leaf tasks have proper structure
      leafTasks.forEach((task) => {
        expect(task.action).toBeTruthy();
        expect(task.type).toBe('execute');
        expect(task.config).toBeDefined();
        expect(Array.isArray(task.config)).toBe(true);
        expect(task.params).toBeDefined();
        expect(task.params?.skill).toBeDefined();
        expect(task.params?.variant).toBeDefined();
      });

      // Verify we have 3 alpha tasks and 3 beta tasks
      const alphaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'alpha'
      );
      const betaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'beta'
      );

      expect(alphaTasks.length).toBe(3);
      expect(betaTasks.length).toBe(3);

      // Verify each variant has navigate + 2 build tasks
      const alphaNavigate = alphaTasks.filter(
        (task) => task.params?.skill === 'Navigate To Project'
      );
      const alphaBuild = alphaTasks.filter(
        (task) => task.params?.skill === 'Build Project'
      );

      expect(alphaNavigate.length).toBe(1);
      expect(alphaBuild.length).toBe(2);

      const betaNavigate = betaTasks.filter(
        (task) => task.params?.skill === 'Navigate To Project'
      );
      const betaBuild = betaTasks.filter(
        (task) => task.params?.skill === 'Build Project'
      );

      expect(betaNavigate.length).toBe(1);
      expect(betaBuild.length).toBe(2);

      // Verify config arrays
      expect(alphaNavigate[0].config).toEqual(['project.alpha.repo']);
      expect(betaNavigate[0].config).toEqual(['project.beta.repo']);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles non-existent variant gracefully',
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

      // Load build skill that only has alpha and beta variants
      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once
      renderBasePrompt(baseInstructions);

      // Request gamma variant (third variant - testing)
      const userCommand = 'build gamma';

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

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 3 leaf tasks: navigate, generate, compile
      expect(leafTasks.length).toBe(3);

      // All tasks should have gamma variant
      const executeTasks = leafTasks.filter(
        (task) => task.type === TaskType.Execute
      );
      expect(executeTasks.length).toBe(3);

      executeTasks.forEach((task) => {
        expect(task.params?.variant).toBe('gamma');
      });
    },
    LLM_TEST_TIMEOUT
  );
});
