import { beforeEach, describe, expect, it } from 'vitest';

import { TaskType } from '../src/types/types.js';

import { AnthropicServiceMock } from './mocks/AnthropicServiceMock.js';

describe('Integration Tests', () => {
  let mockService: AnthropicServiceMock;

  beforeEach(() => {
    mockService = new AnthropicServiceMock('test-key');
  });

  describe('Single task processing', () => {
    it('processes single task command', async () => {
      mockService.setResponse('change dir to ~', [
        {
          action: 'Change directory to the home folder',
          type: TaskType.Execute,
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'change dir to ~',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'Change directory to the home folder',
          type: TaskType.Execute,
          config: [],
        },
      ]);
    });

    it('processes abbreviations', async () => {
      mockService.setResponse('install deps', [
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool('install deps', 'plan');

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
      ]);
    });
  });

  describe('Multiple task processing', () => {
    it('processes comma-separated tasks', async () => {
      mockService.setResponse('install deps, run tests', [
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool(
        'install deps, run tests',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ]);
    });

    it('processes semicolon-separated tasks', async () => {
      mockService.setResponse('create file; add content', [
        { action: 'Create a file', type: TaskType.Execute, config: [] },
        { action: 'Add content', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool(
        'create file; add content',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Create a file', type: TaskType.Execute, config: [] },
        { action: 'Add content', type: TaskType.Execute, config: [] },
      ]);
    });

    it('processes and-separated tasks', async () => {
      mockService.setResponse('build project and deploy', [
        { action: 'Build the project', type: TaskType.Execute, config: [] },
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool(
        'build project and deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Build the project', type: TaskType.Execute, config: [] },
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ]);
    });

    it('processes three tasks', async () => {
      mockService.setResponse('install deps, run tests, deploy', [
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool(
        'install deps, run tests, deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: TaskType.Execute, config: [] },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
        { action: 'Deploy', type: TaskType.Execute, config: [] },
      ]);
    });
  });

  describe('Error handling', () => {
    it('throws error when service fails', async () => {
      mockService.setShouldFail(true, 'API connection failed');

      await expect(
        mockService.processWithTool('any command', 'plan')
      ).rejects.toThrow('API connection failed');
    });

    it('handles authentication errors', async () => {
      mockService.setShouldFail(true, 'Invalid API key');

      await expect(
        mockService.processWithTool('any command', 'plan')
      ).rejects.toThrow('Invalid API key');
    });
  });

  describe('Mock service utilities', () => {
    it('uses default response when no specific response set', async () => {
      mockService.setDefaultResponse([
        { action: 'Default task', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool(
        'unknown command',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Default task', type: TaskType.Execute, config: [] },
      ]);
    });

    it('resets to default state', async () => {
      mockService.setResponse('test', [
        { action: 'Custom response', type: TaskType.Execute, config: [] },
      ]);
      mockService.setShouldFail(true);

      mockService.reset();

      const result = await mockService.processWithTool('test', 'plan');
      expect(result.tasks).toEqual([
        { action: 'mock task', type: TaskType.Execute, config: [] },
      ]);
    });
  });

  describe('Define type tasks', () => {
    it('processes define type with options', async () => {
      mockService.setResponse('do something', [
        {
          action: 'Clarify what action to perform',
          type: TaskType.Define,
          params: {
            options: [
              'Deploy application',
              'Run linter',
              'Generate documentation',
            ],
          },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('do something', 'plan');

      expect(result.tasks).toEqual([
        {
          action: 'Clarify what action to perform',
          type: TaskType.Define,
          params: {
            options: [
              'Deploy application',
              'Run linter',
              'Generate documentation',
            ],
          },
          config: [],
        },
      ]);
    });

    it('processes mixed clear and define tasks', async () => {
      mockService.setResponse('build, do something, test', [
        { action: 'Build the project', type: TaskType.Execute, config: [] },
        {
          action: 'Clarify what action to perform',
          type: TaskType.Define,
          params: { options: ['Deploy', 'Lint', 'Document'] },
          config: [],
        },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool(
        'build, do something, test',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Build the project', type: TaskType.Execute, config: [] },
        {
          action: 'Clarify what action to perform',
          type: TaskType.Define,
          params: { options: ['Deploy', 'Lint', 'Document'] },
          config: [],
        },
        { action: 'Run tests', type: TaskType.Execute, config: [] },
      ]);
    });
  });

  describe('Introspect type tasks', () => {
    it('processes introspection request', async () => {
      mockService.setResponse('list your skills', [
        {
          action: 'List available capabilities',
          type: TaskType.Introspect,
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'list your skills',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'List available capabilities',
          type: TaskType.Introspect,
          config: [],
        },
      ]);
    });

    it('processes introspection with filter', async () => {
      mockService.setResponse('list skills for deployment', [
        {
          action: 'List deployment skills',
          type: TaskType.Introspect,
          params: { filter: 'deployment' },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'list skills for deployment',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'List deployment skills',
          type: TaskType.Introspect,
          params: { filter: 'deployment' },
          config: [],
        },
      ]);
    });

    it('processes "what can you do" query', async () => {
      mockService.setResponse('what can you do', [
        {
          action: 'Show available capabilities',
          type: TaskType.Introspect,
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'what can you do',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'Show available capabilities',
          type: TaskType.Introspect,
          config: [],
        },
      ]);
    });

    it('processes introspect execution with capabilities', async () => {
      mockService.setResponse('execute introspection', [
        {
          action: 'PLAN: Break down requests into actionable steps',
          type: TaskType.Introspect,
          config: [],
        },
        {
          action: 'INTROSPECT: List and describe capabilities',
          type: TaskType.Introspect,
          config: [],
        },
        {
          action: 'ANSWER: Explain concepts and provide information',
          type: TaskType.Introspect,
          config: [],
        },
        {
          action: 'EXECUTE: Run shell commands and programs',
          type: TaskType.Introspect,
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'execute introspection',
        'schedule'
      );

      expect(result.tasks).toHaveLength(4);
      expect(result.tasks[0].type).toBe(TaskType.Introspect);
      expect(result.tasks[0].action).toContain('PLAN');
      expect(result.tasks[1].action).toContain('INTROSPECT');
      expect(result.tasks[2].action).toContain('ANSWER');
      expect(result.tasks[3].action).toContain('EXECUTE');
    });

    it('processes "flex" synonym for introspection', async () => {
      mockService.setResponse('flex', [
        {
          action: 'Show available capabilities',
          type: TaskType.Introspect,
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('flex', 'plan');

      expect(result.tasks).toEqual([
        {
          action: 'Show available capabilities',
          type: TaskType.Introspect,
          config: [],
        },
      ]);
    });

    it('processes "show off" synonym for introspection', async () => {
      mockService.setResponse('show off', [
        {
          action: 'Display capabilities and skills',
          type: TaskType.Introspect,
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('show off', 'plan');

      expect(result.tasks).toEqual([
        {
          action: 'Display capabilities and skills',
          type: TaskType.Introspect,
          config: [],
        },
      ]);
    });
  });

  describe('Config type tasks', () => {
    it('processes config request', async () => {
      mockService.setResponse('config', [
        {
          action: 'Configure settings',
          type: TaskType.Config,
          params: { query: 'app' },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('config', 'plan');

      expect(result.tasks).toEqual([
        {
          action: 'Configure settings',
          type: TaskType.Config,
          params: { query: 'app' },
          config: [],
        },
      ]);
    });

    it('processes config with specific section', async () => {
      mockService.setResponse('config anthropic', [
        {
          action: 'Configure Anthropic settings',
          type: TaskType.Config,
          params: { query: 'anthropic' },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'config anthropic',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'Configure Anthropic settings',
          type: TaskType.Config,
          params: { query: 'anthropic' },
          config: [],
        },
      ]);
    });

    it('processes change settings request', async () => {
      mockService.setResponse('change settings', [
        {
          action: 'Modify application settings',
          type: TaskType.Config,
          params: { query: 'app' },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool(
        'change settings',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'Modify application settings',
          type: TaskType.Config,
          params: { query: 'app' },
          config: [],
        },
      ]);
    });

    it('config tool returns specific keys', async () => {
      mockService.setResponse('anthropic', [
        {
          action: 'Configure API key',
          type: TaskType.Config,
          params: { key: 'anthropic.key' },
          config: [],
        },
        {
          action: 'Configure model',
          type: TaskType.Config,
          params: { key: 'anthropic.model' },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('anthropic', 'config');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].type).toBe(TaskType.Config);
      expect(result.tasks[0].params?.key).toBe('anthropic.key');
      expect(result.tasks[1].params?.key).toBe('anthropic.model');
    });

    it('detects all-config tasks', async () => {
      mockService.setResponse('run settings', [
        {
          action: 'Configure API key',
          type: TaskType.Config,
          params: { key: 'anthropic.key' },
          config: [],
        },
        {
          action: 'Configure model',
          type: TaskType.Config,
          params: { key: 'anthropic.model' },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('run settings', 'plan');

      const allConfig = result.tasks.every(
        (task) => task.type === TaskType.Config
      );

      expect(allConfig).toBe(true);
    });
  });
});
