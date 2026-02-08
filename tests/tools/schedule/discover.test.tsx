import { describe, expect, it } from 'vitest';

import { AnthropicService } from '../../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  loadConfig,
} from '../../../src/configuration/io.js';
import { toolRegistry } from '../../../src/services/registry.js';
import { formatSkillsForPrompt } from '../../../src/services/skills.js';
import { formatTaskAsYaml } from '../../../src/execution/processing.js';
import type { ScheduledTask } from '../../../src/types/types.js';

import {
  getAllLeafTasks,
  LLM_TEST_TIMEOUT,
  loadTestSkills,
  renderCompactPrompt,
  renderResponse,
} from './test-helpers.js';

describe('Discover fallback behavior', () => {
  it(
    'creates discover type for unmatched verb with discover fallback',
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

      // Provide a skill so "list" doesn't match it
      const skillNames = ['navigate-to-project.skill.md'];
      const skills = loadTestSkills(skillNames);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Simulate "do" prefix: strip prefix and add discover metadata
      const userCommand = formatTaskAsYaml('list open ports', {
        fallback: 'discover',
      });

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

      // Should create a discover task, not ignore
      expect(leafTasks.length).toBe(1);
      expect(leafTasks[0].type).toBe('discover');
      expect(leafTasks[0].params?.query).toBeDefined();

      console.log('\n✓ Discover fallback for unmatched verb verified:');
      console.log('  1. "list open ports" with discover fallback');
      console.log('  2. Creates discover task (not ignore)');
      console.log('  3. Task has query param');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates ignore type for same verb without discover fallback',
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

      // Same request without discover fallback metadata
      const userCommand = 'list open ports';

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

      // Without discover fallback, should create ignore task
      expect(leafTasks.length).toBe(1);
      expect(leafTasks[0].type).toBe('ignore');

      console.log('\n✓ Ignore fallback for unmatched verb verified:');
      console.log('  1. "list open ports" without discover fallback');
      console.log('  2. Creates ignore task (default behavior)');
    },
    LLM_TEST_TIMEOUT
  );
});
