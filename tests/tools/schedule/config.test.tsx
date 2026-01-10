import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../../src/configuration/io.js';
import { toolRegistry } from '../../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../../src/services/skills.js';
import type { ScheduledTask } from '../../../src/types/types.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderCompactPrompt,
  renderResponse,
} from './test-helpers.js';

describe('Config extraction and validation', () => {
  it(
    'extracts config paths from strict placeholders',
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

      const skillNames = ['navigate-to-project.skill.md'];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'navigate to alpha';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills, skillNames);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      expect(leafTasks.length).toBe(1);

      const task = leafTasks[0];
      expect(task.config).toBeDefined();
      expect(Array.isArray(task.config)).toBe(true);
      expect(task.config).toContain('project.alpha.repo');

      console.log('\n✓ Strict placeholder config extraction verified:');
      console.log('  1. Config path extracted from task');
      console.log('  2. Path contains resolved variant: project.alpha.repo');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'extracts multiple config paths from single task',
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

      const skillNames = ['deploy-app.skill.md'];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // This should create a task with multiple config paths
      const userCommand = 'deploy gamma to production';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills, skillNames);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // Find the deploy task (last one)
      const deployTask = leafTasks[leafTasks.length - 1];
      expect(deployTask.config).toBeDefined();
      expect(Array.isArray(deployTask.config)).toBe(true);

      // Should have exactly 2 config paths: environment.production.url and token
      expect(deployTask.config?.length).toBe(2);
      expect(deployTask.config).toContain('environment.production.url');
      expect(deployTask.config).toContain('environment.production.token');

      console.log('\n✓ Multiple config paths extraction verified:');
      console.log('  1. Deploy task has 2 config paths');
      console.log('  2. environment.production.url extracted');
      console.log('  3. environment.production.token extracted');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'resolves variant placeholders in config paths',
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

      const skillNames = [
        'build-project.skill.md',
        'navigate-to-project.skill.md',
      ];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'build beta';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills, skillNames);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // First task should navigate to beta repo
      const firstTask = leafTasks[0];
      expect(firstTask.config).toBeDefined();
      expect(firstTask.config).toContain('project.beta.repo');

      // All tasks should have variant: beta
      leafTasks.forEach((task) => {
        if (task.params?.variant) {
          expect(task.params.variant).toBe('beta');
        }
      });

      // All config paths should have 'beta' resolved (no VARIANT)
      leafTasks.forEach((task) => {
        if (task.config && task.config.length > 0) {
          task.config.forEach((path) => {
            expect(path).not.toContain('VARIANT');
            if (path.includes('project.')) {
              expect(path).toContain('beta');
            }
          });
        }
      });

      console.log('\n✓ Variant placeholder resolution verified:');
      console.log('  1. All tasks have variant: beta');
      console.log('  2. No unresolved VARIANT placeholders');
      console.log('  3. Config paths contain resolved "beta" variant');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles same config path in multiple tasks correctly',
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

      const skillNames = [
        'build-project.skill.md',
        'navigate-to-project.skill.md',
      ];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Build alpha and beta - both will need project.alpha.repo and project.beta.repo
      const userCommand = 'build alpha and beta';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills, skillNames);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // Find all tasks that use project.alpha.repo
      const alphaRepoTasks = leafTasks.filter(
        (task) => task.config && task.config.includes('project.alpha.repo')
      );

      // Find all tasks that use project.beta.repo
      const betaRepoTasks = leafTasks.filter(
        (task) => task.config && task.config.includes('project.beta.repo')
      );

      // Should have exactly 1 navigate task for each variant
      expect(alphaRepoTasks.length).toBe(1);
      expect(betaRepoTasks.length).toBe(1);

      // Each task should have valid config array
      leafTasks.forEach((task) => {
        if (task.config && task.config.length > 0) {
          expect(Array.isArray(task.config)).toBe(true);
          // Config paths should be in dot notation
          task.config.forEach((path) => {
            expect(typeof path).toBe('string');
            expect(path.includes('.')).toBe(true);
          });
        }
      });

      console.log('\n✓ Same config path in multiple tasks verified:');
      console.log('  1. Alpha variant task uses project.alpha.repo');
      console.log('  2. Beta variant task uses project.beta.repo');
      console.log('  3. Config paths use dot notation');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'extracts config paths from non-variant placeholders',
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

      const skillNames = ['list-files.skill.md'];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'list files';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills, skillNames);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // List Files skill should create 1-2 tasks (could be split or combined)
      expect(leafTasks.length).toBeGreaterThanOrEqual(1);
      expect(leafTasks.length).toBeLessThanOrEqual(2);

      // All tasks should have config arrays
      leafTasks.forEach((task) => {
        expect(task.config).toBeDefined();
        expect(Array.isArray(task.config)).toBe(true);
      });

      // List Files skill has TWO config placeholders - verify both are extracted
      const allConfigs = leafTasks.flatMap((task) => task.config || []);
      expect(allConfigs).toContain('list.directory');
      expect(allConfigs).toContain('list.pattern');

      console.log('\n✓ Non-variant config extraction verified:');
      console.log('  1. list.directory config extracted');
      console.log('  2. list.pattern config extracted');
      console.log('  3. Both placeholders captured from skill');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles config with duplicate paths gracefully',
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

      const skillNames = ['deploy-app.skill.md'];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'deploy alpha to production';

      const startTime = Date.now();
      const result = await service.processWithTool(
        userCommand,
        'schedule',
        enhancedInstructions
      );
      const duration = Date.now() - startTime;

      renderCompactPrompt(userCommand, baseInstructions, skills, skillNames);
      renderResponse(duration, result);

      expect(result.message).toBeDefined();
      expect(result.tasks).toBeDefined();

      const tasks = result.tasks as unknown as ScheduledTask[];
      const leafTasks = getAllLeafTasks(tasks);

      // Verify all config arrays contain unique paths (no duplicates within a task)
      leafTasks.forEach((task) => {
        if (task.config && task.config.length > 0) {
          const uniquePaths = new Set(task.config);
          expect(uniquePaths.size).toBe(task.config.length);
        }
      });

      console.log('\n✓ Duplicate config path handling verified:');
      console.log('  1. No duplicate paths within any task');
      console.log('  2. Config arrays contain unique entries');
    },
    LLM_TEST_TIMEOUT
  );
});
