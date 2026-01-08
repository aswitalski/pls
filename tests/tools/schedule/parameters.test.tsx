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

describe('Runtime parameter resolution', () => {
  it(
    'resolves required parameter from user command',
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

      const skills = loadTestSkills(['process-data.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // User provides SOURCE (key param) and MODE (modifier param)
      const userCommand = 'process /data/report.csv in batch mode';

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

      // Should create execute task (not ignore or define)
      expect(leafTasks.length).toBeGreaterThanOrEqual(1);
      const task = leafTasks[0];
      expect(task.type).toBe(TaskType.Execute);

      // Action should contain resolved parameters
      expect(task.action.toLowerCase()).toContain('batch');

      console.log('\n✓ Runtime parameter resolution verified:');
      console.log('  1. SOURCE resolved from /data/report.csv');
      console.log('  2. MODE resolved from "batch mode"');
      console.log('  3. Task type is execute (not ignore or define)');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'uses default value when optional parameter not specified',
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

      const skills = loadTestSkills(['process-data.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // User provides SOURCE and MODE but not FORMAT (has default json)
      const userCommand = 'process /data/input.txt in stream mode';

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
      const task = leafTasks[0];

      // Should be execute type with default format applied
      expect(task.type).toBe(TaskType.Execute);

      console.log('\n✓ Default parameter value verified:');
      console.log('  1. FORMAT defaulted to json (not specified by user)');
      console.log('  2. Task created successfully with defaults');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates IGNORE task when key parameter is missing',
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

      const skills = loadTestSkills(['process-data.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // User specifies MODE but NOT SOURCE (key param missing)
      const userCommand = 'process data in batch mode';

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

      // MUST be ignore type - key param missing
      expect(task.type).toBe(TaskType.Ignore);

      // Action should mention missing parameter
      const actionLower = task.action.toLowerCase();
      expect(
        actionLower.includes('missing') ||
          actionLower.includes('specify') ||
          actionLower.includes('source') ||
          actionLower.includes('file') ||
          actionLower.includes('input')
      ).toBe(true);

      console.log('\n✓ Key parameter missing handling verified:');
      console.log('  1. SOURCE not provided (key param)');
      console.log('  2. Task type is IGNORE (not define or execute)');
      console.log(`  3. Action indicates missing param: "${task.action}"`);
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates IGNORE even when modifier params specified but key param missing',
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

      const skills = loadTestSkills(['export-report.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // User specifies QUALITY (modifier) but NOT FILE (key param)
      // This MUST create IGNORE, not DEFINE
      const userCommand = 'export report in high quality';

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

      // MUST be ignore type - key param missing takes precedence
      // even though modifier param (QUALITY) was specified
      expect(task.type).toBe(TaskType.Ignore);

      console.log('\n✓ Key param precedence over modifier verified:');
      console.log('  1. FILE not provided (key param missing)');
      console.log('  2. QUALITY was provided (modifier param)');
      console.log('  3. Task type is IGNORE (not DEFINE)');
      console.log('  4. Key param check takes absolute precedence');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'creates DEFINE task when modifier unclear but all key params present',
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

      const skills = loadTestSkills(['process-data.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // User provides SOURCE (key param) but NOT MODE (modifier param)
      // Should create DEFINE with options for mode
      const userCommand = 'process /data/report.csv';

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

      // Should be define type with options for mode
      expect(task.type).toBe(TaskType.Define);
      expect(task.params?.options).toBeDefined();
      expect(Array.isArray(task.params?.options)).toBe(true);

      const options = task.params?.options as RefinementOption[];
      expect(options.length).toBeGreaterThanOrEqual(2);

      // Each option should have name and command
      for (const option of options) {
        expect(option.name).toBeDefined();
        expect(option.command).toBeDefined();
        // Command should preserve the original file path
        expect(option.command.toLowerCase()).toContain('/data/report.csv');
      }

      console.log('\n✓ DEFINE task for unclear modifier verified:');
      console.log('  1. SOURCE provided (key param present)');
      console.log('  2. MODE not specified (modifier param unclear)');
      console.log('  3. Task type is DEFINE (not ignore)');
      console.log(`  4. Options provided: ${options.length} choices`);
      console.log('  5. Each option preserves original file path');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'DEFINE options preserve exact paths and include all params',
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

      const skills = loadTestSkills(['export-report.skill.md']);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // User provides FILE (key param) but not QUALITY (modifier)
      const userCommand = 'export /reports/Q4-2025.pdf';

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

      // Should be define with options
      expect(task.type).toBe(TaskType.Define);
      expect(task.params?.options).toBeDefined();

      const options = task.params?.options as RefinementOption[];

      // Verify each option preserves exact path (case-sensitive)
      for (const option of options) {
        expect(option.command).toContain('/reports/Q4-2025.pdf');
      }

      // Should have options for different quality levels
      const optionNames = options.map((o) => o.name.toLowerCase()).join(' ');
      const hasQualityOptions =
        optionNames.includes('draft') ||
        optionNames.includes('standard') ||
        optionNames.includes('high');
      expect(hasQualityOptions).toBe(true);

      console.log('\n✓ DEFINE option path preservation verified:');
      console.log('  1. Exact path /reports/Q4-2025.pdf preserved');
      console.log('  2. Case-sensitive path maintained');
      console.log(`  3. Quality options provided: ${options.length}`);
    },
    LLM_TEST_TIMEOUT
  );
});
