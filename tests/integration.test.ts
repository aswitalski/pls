import { beforeEach, describe, expect, it } from 'vitest';

import { TaskType } from '../src/types/types.js';

import { AnthropicServiceMock } from './mocks/AnthropicServiceMock.js';

describe('Anthropic service mock', () => {
  let mockService: AnthropicServiceMock;

  beforeEach(() => {
    mockService = new AnthropicServiceMock('test-key');
  });

  describe('Response configuration', () => {
    it('returns configured response for specific command', async () => {
      mockService.setResponse('test command', [
        { action: 'Test action', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool('test command', 'plan');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].action).toBe('Test action');
    });

    it('uses default response for unconfigured commands', async () => {
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

    it('prefers specific response over default', async () => {
      mockService.setDefaultResponse([
        { action: 'Default', type: TaskType.Execute, config: [] },
      ]);
      mockService.setResponse('specific', [
        { action: 'Specific', type: TaskType.Execute, config: [] },
      ]);

      const result = await mockService.processWithTool('specific', 'plan');

      expect(result.tasks[0].action).toBe('Specific');
    });
  });

  describe('Error simulation', () => {
    it('throws configured error when failure mode enabled', async () => {
      mockService.setShouldFail(true, 'API connection failed');

      await expect(
        mockService.processWithTool('any command', 'plan')
      ).rejects.toThrow('API connection failed');
    });

    it('supports different error messages', async () => {
      mockService.setShouldFail(true, 'Invalid API key');

      await expect(
        mockService.processWithTool('any command', 'plan')
      ).rejects.toThrow('Invalid API key');
    });
  });

  describe('State management', () => {
    it('resets to initial state', async () => {
      mockService.setResponse('test', [
        { action: 'Custom', type: TaskType.Execute, config: [] },
      ]);
      mockService.setShouldFail(true);

      mockService.reset();

      const result = await mockService.processWithTool('test', 'plan');
      expect(result.tasks[0].action).toBe('mock task');
    });
  });

  describe('Task type support', () => {
    it.each([
      TaskType.Execute,
      TaskType.Define,
      TaskType.Introspect,
      TaskType.Config,
      TaskType.Answer,
    ])('handles %s task type', async (type) => {
      mockService.setResponse(`${type} command`, [
        { action: `${type} action`, type, config: [] },
      ]);

      const result = await mockService.processWithTool(
        `${type} command`,
        'plan'
      );

      expect(result.tasks[0].type).toBe(type);
    });

    it('preserves task params', async () => {
      mockService.setResponse('define task', [
        {
          action: 'Choose option',
          type: TaskType.Define,
          params: { options: ['A', 'B', 'C'] },
          config: [],
        },
      ]);

      const result = await mockService.processWithTool('define task', 'plan');

      expect(result.tasks[0].params?.options).toEqual(['A', 'B', 'C']);
    });
  });
});
