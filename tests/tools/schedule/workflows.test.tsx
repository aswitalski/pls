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

describe('Complex workflows and sequential requests', () => {
  it(
    'handles build + deploy workflow',
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

      // Load all skills
      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
        'deploy-app.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once

      // Test build + deploy workflow
      const userCommand = 'build beta and deploy to staging';

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
      expect(tasks.length).toBe(2); // Build and Deploy

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 6 leaf tasks: 3 from Build + 3 from Deploy
      expect(leafTasks.length).toBe(6);

      // Verify all tasks are execute type
      const executeTasks = leafTasks.filter(
        (task) => task.type === TaskType.Execute
      );
      expect(executeTasks.length).toBe(leafTasks.length);

      // Verify we have tasks from both Build Project and Deploy App
      const buildTasks = leafTasks.filter(
        (task) => task.params?.skill === 'Build Project'
      );
      const deployTasks = leafTasks.filter(
        (task) => task.params?.skill === 'Deploy App'
      );

      expect(buildTasks.length).toBe(2); // Generate + Compile (Navigate has no skill param)
      expect(deployTasks.length).toBe(3); // CD + Checkout + Deploy

      // Verify correct variants (beta is the project variant being deployed)
      buildTasks.forEach((task) => {
        expect(task.params?.variant).toBe('beta');
      });

      deployTasks.forEach((task) => {
        expect(task.params?.variant).toBe('beta');
      });

      console.log('\n✓ Build + deploy workflow verified:');
      console.log('  1. 6 leaf tasks total (3 build + 3 deploy)');
      console.log('  2. Build tasks: 2 (Generate + Compile)');
      console.log('  3. Deploy tasks: 3 (CD + Checkout + Deploy)');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles multiple answer tasks interlaced with execute',
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

      // Load build skill only
      const skills = loadTestSkills([
        'navigate-to-project.skill.md',
        'build-project.skill.md',
      ]);
      const skillsSection = formatSkillsForPrompt(skills);

      const baseInstructions = toolRegistry.getInstructions('schedule');
      const enhancedInstructions = baseInstructions + skillsSection;

      // Show base prompt once

      // Test unrelated answer + build + answer: answer about rumination, build, answer about tdd
      const userCommand = 'explain rumination, build gamma, explain tdd';

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
      expect(tasks.length).toBe(3); // Explain rumination + Build gamma + Explain TDD

      const leafTasks = getAllLeafTasks(tasks);

      // Should have exactly 5 leaf tasks: 2 answer + 3 execute
      // Answer tasks may be wrapped in parent tasks with descriptive actions
      expect(leafTasks.length).toBe(5);

      // Verify we have answer and execute tasks
      const answerTasks = leafTasks.filter(
        (task) => task.type === TaskType.Answer || task.type === TaskType.Report
      );
      const executeTasks = leafTasks.filter(
        (task) => task.type === TaskType.Execute
      );

      expect(answerTasks.length).toBe(2); // Exactly 2 answer tasks (rumination + tdd)
      expect(executeTasks.length).toBe(3); // Exactly 3 execute tasks (navigate + generate + compile)

      // Verify all answer tasks have proper type field
      answerTasks.forEach((task) => {
        expect(['answer', 'report']).toContain(task.type);
      });

      // Verify all execute tasks have gamma variant
      executeTasks.forEach((task) => {
        expect(task.params?.variant).toBe('gamma');
      });

      // Verify we have one navigate task and two build tasks
      const navigateTasks = executeTasks.filter(
        (task) => task.params?.skill === 'Navigate To Project'
      );
      const buildTasks = executeTasks.filter(
        (task) => task.params?.skill === 'Build Project'
      );

      expect(navigateTasks.length).toBe(1);
      expect(buildTasks.length).toBe(2);

      console.log('\n✓ Interlaced answer and execute tasks verified:');
      console.log('  1. 2 answer tasks (rumination + tdd)');
      console.log('  2. 3 execute tasks (navigate + generate + compile)');
      console.log('  3. All execute tasks have gamma variant');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles comma-separated sequential requests',
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

      // Test comma-separated requests
      const userCommand = 'build alpha, build beta';

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

      // Should have tasks for both alpha and beta variants
      const alphaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'alpha'
      );
      const betaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'beta'
      );

      expect(alphaTasks.length).toBe(3); // Navigate + Generate + Compile for alpha
      expect(betaTasks.length).toBe(3); // Navigate + Generate + Compile for beta

      // Each variant should have execution tasks
      alphaTasks.forEach((task) => {
        expect(task.type).toBe('execute');
      });

      betaTasks.forEach((task) => {
        expect(task.type).toBe('execute');
      });

      console.log('\n✓ Comma-separated requests verified:');
      console.log('  1. "build alpha, build beta" parsed correctly');
      console.log('  2. Alpha tasks: 3, Beta tasks: 3');
      console.log('  3. All tasks are execute type');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles semicolon-separated sequential requests',
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

      // Test semicolon-separated requests
      const userCommand = 'navigate to alpha; navigate to beta';

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
      expect(tasks.length).toBeGreaterThan(0);

      const leafTasks = getAllLeafTasks(tasks);

      // Should have tasks for both alpha and beta
      const alphaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'alpha'
      );
      const betaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'beta'
      );

      expect(alphaTasks.length).toBe(1);
      expect(betaTasks.length).toBe(1);

      // All should be execute type
      leafTasks.forEach((task) => {
        expect(task.type).toBe('execute');
      });

      console.log('\n✓ Semicolon-separated requests verified:');
      console.log('  1. "navigate to alpha; navigate to beta" parsed');
      console.log('  2. Alpha task: 1, Beta task: 1');
      console.log('  3. All tasks are execute type');
    },
    LLM_TEST_TIMEOUT
  );

  it(
    'handles mixed separators in sequential requests',
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

      // Test mixed separators: comma and semicolon
      const userCommand = 'navigate to alpha, build alpha; navigate to beta';

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
      expect(tasks.length).toBeGreaterThan(0);

      const leafTasks = getAllLeafTasks(tasks);

      // Should have tasks for alpha and beta variants
      const alphaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'alpha'
      );
      const betaTasks = leafTasks.filter(
        (task) => task.params?.variant === 'beta'
      );

      expect(alphaTasks.length).toBeGreaterThan(0);
      expect(betaTasks.length).toBeGreaterThan(0);

      // All should be execute type
      leafTasks.forEach((task) => {
        expect(task.type).toBe('execute');
      });

      console.log('\n✓ Mixed separators handling verified:');
      console.log('  1. Comma and semicolon separators parsed');
      console.log(`  2. Alpha tasks: ${alphaTasks.length}`);
      console.log(`  3. Beta tasks: ${betaTasks.length}`);
    },
    LLM_TEST_TIMEOUT
  );
});
