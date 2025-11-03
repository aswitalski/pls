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
        'change directory to the home folder',
      ]);

      const result = await mockService.processCommand('change dir to ~');

      expect(result).toEqual(['change directory to the home folder']);
    });

    it('processes abbreviations', async () => {
      mockService.setResponse('install deps', ['install dependencies']);

      const result = await mockService.processCommand('install deps');

      expect(result).toEqual(['install dependencies']);
    });
  });

  describe('Multiple task processing', () => {
    it('processes comma-separated tasks', async () => {
      mockService.setResponse('install deps, run tests', [
        'install dependencies',
        'run tests',
      ]);

      const result = await mockService.processCommand(
        'install deps, run tests'
      );

      expect(result).toEqual(['install dependencies', 'run tests']);
    });

    it('processes semicolon-separated tasks', async () => {
      mockService.setResponse('create file; add content', [
        'create a file',
        'add content',
      ]);

      const result = await mockService.processCommand(
        'create file; add content'
      );

      expect(result).toEqual(['create a file', 'add content']);
    });

    it('processes and-separated tasks', async () => {
      mockService.setResponse('build project and deploy', [
        'build the project',
        'deploy',
      ]);

      const result = await mockService.processCommand(
        'build project and deploy'
      );

      expect(result).toEqual(['build the project', 'deploy']);
    });

    it('processes three tasks', async () => {
      mockService.setResponse('install deps, run tests, deploy', [
        'install dependencies',
        'run tests',
        'deploy',
      ]);

      const result = await mockService.processCommand(
        'install deps, run tests, deploy'
      );

      expect(result).toEqual(['install dependencies', 'run tests', 'deploy']);
    });
  });

  describe('Error handling', () => {
    it('throws error when service fails', async () => {
      mockService.setShouldFail(true, 'API connection failed');

      await expect(mockService.processCommand('any command')).rejects.toThrow(
        'API connection failed'
      );
    });

    it('handles authentication errors', async () => {
      mockService.setShouldFail(true, 'Invalid API key');

      await expect(mockService.processCommand('any command')).rejects.toThrow(
        'Invalid API key'
      );
    });
  });

  describe('Mock service utilities', () => {
    it('uses default response when no specific response set', async () => {
      mockService.setDefaultResponse(['default task']);

      const result = await mockService.processCommand('unknown command');

      expect(result).toEqual(['default task']);
    });

    it('resets to default state', async () => {
      mockService.setResponse('test', ['custom response']);
      mockService.setShouldFail(true);

      mockService.reset();

      const result = await mockService.processCommand('test');
      expect(result).toEqual(['mock task']);
    });
  });
});
