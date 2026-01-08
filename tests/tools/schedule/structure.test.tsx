import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../../src/configuration/io.js';
import { toolRegistry } from '../../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../../src/services/skills.js';
import { TaskType } from '../../../src/types/types.js';
import type {
  RefinementOption,
  ScheduledTask,
  Task,
} from '../../../src/types/types.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderCompactPrompt,
  renderResponse,
} from './test-helpers.js';

describe('Task structure validation', () => {
  it(
    'single-step skill can use leaf execute task',
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

      const skills = loadTestSkills(['single-step.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'run quick check';

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

      // Single-step skill should have exactly 1 leaf task
      expect(leafTasks.length).toBe(1);

      const task = leafTasks[0];
      expect(task.type).toBe(TaskType.Execute);

      console.log('\n✓ Single-step skill structure verified:');
      console.log('  1. Skill has ONE execution step');
      console.log('  2. Can be leaf execute task (not required to be group)');
      console.log(`  3. Leaf tasks: ${leafTasks.length}`);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'multi-step skill MUST use group structure with subtasks',
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

      const skills = loadTestSkills(['multi-step.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'run full pipeline';

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

      // Multi-step skill should create group structure
      expect(tasks.length).toBeGreaterThanOrEqual(1);

      // The top-level task should be a group (have subtasks)
      const topTask = tasks[0];
      expect(topTask.subtasks).toBeDefined();
      expect(Array.isArray(topTask.subtasks)).toBe(true);
      expect(topTask.subtasks!.length).toBeGreaterThanOrEqual(1);

      // Verify the leaf tasks match the skill's execution steps
      const leafTasks = getAllLeafTasks(tasks);

      // Should have 3 leaf tasks (init, run, cleanup)
      expect(leafTasks.length).toBe(3);

      // All leaf tasks should be execute type
      for (const leaf of leafTasks) {
        expect(leaf.type).toBe(TaskType.Execute);
      }

      console.log('\n✓ Multi-step skill group structure verified:');
      console.log('  1. Skill has THREE execution steps');
      console.log('  2. Top task has subtasks (group structure)');
      console.log(`  3. Leaf tasks: ${leafTasks.length} (matches steps)`);
      console.log('  4. All leaf tasks are execute type');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'multi-step skill with variant uses group structure',
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

      const skills = loadTestSkills(['release-package.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Specify variant to avoid DEFINE task
      const userCommand = 'release to stable channel';

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

      // Should create group structure for multi-step skill
      expect(tasks.length).toBeGreaterThanOrEqual(1);

      const topTask = tasks[0];
      expect(topTask.subtasks).toBeDefined();
      expect(Array.isArray(topTask.subtasks)).toBe(true);

      const leafTasks = getAllLeafTasks(tasks);

      // Should have 3 leaf tasks (build, sign, upload)
      expect(leafTasks.length).toBe(3);

      // Verify variant is resolved in config paths
      const configPaths = leafTasks
        .filter((t) => t.config && t.config.length > 0)
        .flatMap((t) => t.config!);

      // Should have config path with resolved variant
      const hasResolvedVariant = configPaths.some(
        (path) =>
          path.includes('stable') ||
          path.includes('beta') ||
          path.includes('nightly')
      );

      if (configPaths.length > 0) {
        expect(hasResolvedVariant).toBe(true);
      }

      console.log('\n✓ Multi-step skill with variant structure verified:');
      console.log('  1. Multi-step skill uses group structure');
      console.log(`  2. Leaf tasks: ${leafTasks.length}`);
      console.log(`  3. Config paths: ${configPaths.length}`);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'unclear variant creates DEFINE task not placeholder values',
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

      const skills = loadTestSkills(['deploy-environment.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Don't specify which environment - should create DEFINE
      const userCommand = 'deploy the application';

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

      expect(leafTasks.length).toBeGreaterThanOrEqual(1);
      const task = leafTasks[0] as Task;

      // Should create DEFINE task for variant selection
      expect(task.type).toBe(TaskType.Define);
      expect(task.params?.options).toBeDefined();

      const options = task.params?.options as RefinementOption[];
      expect(options.length).toBeGreaterThanOrEqual(2);

      // Verify NO placeholder values like UNKNOWN, <UNKNOWN>, etc.
      const taskJson = JSON.stringify(result.tasks).toLowerCase();
      expect(taskJson).not.toContain('unknown');
      expect(taskJson).not.toContain('<variant>');
      expect(taskJson).not.toContain('{variant}');
      expect(taskJson).not.toContain('unresolved');

      console.log('\n✓ Unclear variant handling verified:');
      console.log('  1. No environment specified by user');
      console.log('  2. DEFINE task created (not execute with placeholder)');
      console.log(`  3. Options provided: ${options.length}`);
      console.log('  4. No UNKNOWN or placeholder values in output');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'all leaf tasks have required type field',
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

      // Use multiple skills to test various task types
      const skills = loadTestSkills([
        'multi-step.skill.md',
        'single-step.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'run pipeline and quick check';

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

      expect(leafTasks.length).toBeGreaterThanOrEqual(1);

      // Every leaf task MUST have a type field
      for (const leaf of leafTasks) {
        expect(leaf.type).toBeDefined();
        expect(typeof leaf.type).toBe('string');

        // Type must be a valid TaskType
        const validTypes = [
          TaskType.Execute,
          TaskType.Answer,
          TaskType.Config,
          TaskType.Define,
          TaskType.Ignore,
          TaskType.Introspect,
          TaskType.Report,
        ];
        expect(validTypes).toContain(leaf.type);
      }

      console.log('\n✓ Leaf task type field validation:');
      console.log(`  1. Total leaf tasks: ${leafTasks.length}`);
      console.log('  2. All leaf tasks have type field');
      console.log('  3. All types are valid TaskType values');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'each leaf task represents one command only',
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

      const skills = loadTestSkills(['multi-step.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'run full pipeline';

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

      // Multi-step skill with 3 steps should have 3 leaf tasks
      // NOT 1 leaf task with 3 commands
      expect(leafTasks.length).toBe(3);

      // Each leaf task represents ONE atomic operation
      for (const leaf of leafTasks) {
        expect(leaf.subtasks).toBeUndefined();
        expect(leaf.type).toBe(TaskType.Execute);
      }

      console.log('\n✓ One command per task validation:');
      console.log('  1. 3-step skill creates 3 leaf tasks');
      console.log('  2. Each leaf task is atomic (no subtasks)');
      console.log('  3. Commands are not merged into single task');
    },
    LLM_TEST_TIMEOUT
  );
});
