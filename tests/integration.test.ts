import { describe, it, expect, beforeEach } from 'vitest';
import { AnthropicServiceMock } from './mocks/AnthropicServiceMock.js';

describe('Integration Tests', () => {
  let mockService: AnthropicServiceMock;

  beforeEach(() => {
    mockService = new AnthropicServiceMock();
  });

  describe('Single task processing', () => {
    it('processes single task command', async () => {
      mockService.setResponse('change dir to ~', [
        { action: 'Change directory to the home folder', type: 'execute' },
      ]);

      const result = await mockService.processWithTool(
        'change dir to ~',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Change directory to the home folder', type: 'execute' },
      ]);
    });

    it('processes abbreviations', async () => {
      mockService.setResponse('install deps', [
        { action: 'Install dependencies', type: 'execute' },
      ]);

      const result = await mockService.processWithTool('install deps', 'plan');

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: 'execute' },
      ]);
    });
  });

  describe('Multiple task processing', () => {
    it('processes comma-separated tasks', async () => {
      mockService.setResponse('install deps, run tests', [
        { action: 'Install dependencies', type: 'execute' },
        { action: 'Run tests', type: 'execute' },
      ]);

      const result = await mockService.processWithTool(
        'install deps, run tests',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: 'execute' },
        { action: 'Run tests', type: 'execute' },
      ]);
    });

    it('processes semicolon-separated tasks', async () => {
      mockService.setResponse('create file; add content', [
        { action: 'Create a file', type: 'execute' },
        { action: 'Add content', type: 'execute' },
      ]);

      const result = await mockService.processWithTool(
        'create file; add content',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Create a file', type: 'execute' },
        { action: 'Add content', type: 'execute' },
      ]);
    });

    it('processes and-separated tasks', async () => {
      mockService.setResponse('build project and deploy', [
        { action: 'Build the project', type: 'execute' },
        { action: 'Deploy', type: 'execute' },
      ]);

      const result = await mockService.processWithTool(
        'build project and deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Build the project', type: 'execute' },
        { action: 'Deploy', type: 'execute' },
      ]);
    });

    it('processes three tasks', async () => {
      mockService.setResponse('install deps, run tests, deploy', [
        { action: 'Install dependencies', type: 'execute' },
        { action: 'Run tests', type: 'execute' },
        { action: 'Deploy', type: 'execute' },
      ]);

      const result = await mockService.processWithTool(
        'install deps, run tests, deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        { action: 'Install dependencies', type: 'execute' },
        { action: 'Run tests', type: 'execute' },
        { action: 'Deploy', type: 'execute' },
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
      mockService.setDefaultResponse([{ action: 'Default task' }]);

      const result = await mockService.processWithTool(
        'unknown command',
        'plan'
      );

      expect(result.tasks).toEqual([{ action: 'Default task' }]);
    });

    it('resets to default state', async () => {
      mockService.setResponse('test', [{ action: 'Custom response' }]);
      mockService.setShouldFail(true);

      mockService.reset();

      const result = await mockService.processWithTool('test', 'plan');
      expect(result.tasks).toEqual([{ action: 'mock task' }]);
    });
  });
});
