import { describe, it, expect, beforeEach } from 'vitest';
import { AnthropicServiceMock } from './mocks/AnthropicServiceMock.js';
import { TaskType } from '../src/types/components.js';

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
        },
      ]);
    });

    it('processes abbreviations', async () => {
      mockService.setResponse('install deps', [
        { action: 'Install dependencies', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool('install deps', 'plan');

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: TaskType.Execute },
      ]);
    });
  });

  describe('Multiple task processing', () => {
    it('processes comma-separated tasks', async () => {
      mockService.setResponse('install deps, run tests', [
        { action: 'Install dependencies', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool(
        'install deps, run tests',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
      ]);
    });

    it('processes semicolon-separated tasks', async () => {
      mockService.setResponse('create file; add content', [
        { action: 'Create a file', type: TaskType.Execute },
        { action: 'Add content', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool(
        'create file; add content',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Create a file', type: TaskType.Execute },
        { action: 'Add content', type: TaskType.Execute },
      ]);
    });

    it('processes and-separated tasks', async () => {
      mockService.setResponse('build project and deploy', [
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Deploy', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool(
        'build project and deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Deploy', type: TaskType.Execute },
      ]);
    });

    it('processes three tasks', async () => {
      mockService.setResponse('install deps, run tests, deploy', [
        { action: 'Install dependencies', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
        { action: 'Deploy', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool(
        'install deps, run tests, deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
        { action: 'Deploy', type: TaskType.Execute },
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
        { action: 'Default task', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool(
        'unknown command',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Default task', type: TaskType.Execute },
      ]);
    });

    it('resets to default state', async () => {
      mockService.setResponse('test', [
        { action: 'Custom response', type: TaskType.Execute },
      ]);
      mockService.setShouldFail(true);

      mockService.reset();

      const result = await mockService.processWithTool('test', 'plan');
      expect(result.tasks).toEqual([
        { action: 'mock task', type: TaskType.Execute },
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
        },
      ]);
    });

    it('processes mixed clear and define tasks', async () => {
      mockService.setResponse('build, do something, test', [
        { action: 'Build the project', type: TaskType.Execute },
        {
          action: 'Clarify what action to perform',
          type: TaskType.Define,
          params: { options: ['Deploy', 'Lint', 'Document'] },
        },
        { action: 'Run tests', type: TaskType.Execute },
      ]);

      const result = await mockService.processWithTool(
        'build, do something, test',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Build the project', type: TaskType.Execute },
        {
          action: 'Clarify what action to perform',
          type: TaskType.Define,
          params: { options: ['Deploy', 'Lint', 'Document'] },
        },
        { action: 'Run tests', type: TaskType.Execute },
      ]);
    });
  });
});
