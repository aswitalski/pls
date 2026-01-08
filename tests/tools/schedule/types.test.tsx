import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../../src/configuration/io.js';
import { toolRegistry } from '../../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../../src/services/skills.js';
import { TaskType } from '../../../src/types/types.js';
import type { ScheduledTask } from '../../../src/types/types.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderCompactPrompt,
  renderResponse,
} from './test-helpers.js';

describe('Task types', () => {
  it(
    'creates introspect type for capability queries',
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

      const userCommand = 'list your skills';

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

      // Should have exactly 1 introspect task
      expect(leafTasks.length).toBe(1);

      const introspectTask = leafTasks.find(
        (task) => task.type === TaskType.Introspect
      );
      expect(introspectTask).toBeDefined();
      expect(introspectTask?.action).toBeTruthy();
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates answer type for information requests',
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

      const userCommand = 'explain quantum computing';

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

      // Should have at least 1 answer task (may break down into multiple subtopics)
      expect(leafTasks.length).toBeGreaterThanOrEqual(1);
      const answerTasks = leafTasks.filter(
        (task) => task.type === TaskType.Answer
      );
      expect(answerTasks.length).toBeGreaterThanOrEqual(1);
      answerTasks.forEach((task) => {
        expect(task.action).toBeTruthy();
      });
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates ignore type for unmatched verbs',
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

      // Only provide navigate skill, not a "validate" skill
      const skills = loadTestSkills(['navigate-to-project.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      const userCommand = 'validate the project';

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

      expect(leafTasks.length).toBe(1);
      expect(leafTasks[0].type).toBe('ignore');
      expect(leafTasks[0].action).toContain('validate');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates config type for configuration requests',
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

      const userCommand = 'change config settings';

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

      // Should have exactly 1 configure task
      expect(leafTasks.length).toBe(1);
      const configTask = leafTasks.find(
        (task) => task.type === TaskType.Config
      );
      expect(configTask).toBeDefined();
      expect(configTask?.action).toBeTruthy();
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates config type with debug query for "pls config debug"',
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

      const userCommand = 'config debug';

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

      expect(leafTasks.length).toBe(1);
      const configTask = leafTasks[0];
      expect(configTask.type).toBe('configure');
      expect(configTask.action).toBeTruthy();
      expect(configTask.params?.query).toBe('debug');
    },
    LLM_TEST_TIMEOUT
  );
});
