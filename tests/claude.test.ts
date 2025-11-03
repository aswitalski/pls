import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicService } from '../src/services/anthropic.js';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(),
  };
});

describe('AnthropicService', () => {
  let service: AnthropicService;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCreate = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const MockedAnthropic = Anthropic as unknown as vi.Mock;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    MockedAnthropic.mockImplementation(function (this: unknown) {
      return {
        messages: {
          create: mockCreate,
        },
      };
    });

    service = new AnthropicService('test-api-key');
  });

  describe('processCommand', () => {
    it('returns single task for plain text response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'change directory to the home folder',
          },
        ],
      });

      const result = await service.processCommand('change dir to ~');

      expect(result).toEqual(['change directory to the home folder']);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 200,
        })
      );
    });

    it('returns multiple tasks for JSON array response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '["install dependencies", "run tests", "deploy"]',
          },
        ],
      });

      const result = await service.processCommand(
        'install deps, run tests, deploy'
      );

      expect(result).toEqual(['install dependencies', 'run tests', 'deploy']);
    });

    it('handles JSON array with whitespace', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '  ["task 1", "task 2"]  ',
          },
        ],
      });

      const result = await service.processCommand('do task 1 and task 2');

      expect(result).toEqual(['task 1', 'task 2']);
    });

    it('treats invalid JSON as single task', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '["incomplete array"',
          },
        ],
      });

      const result = await service.processCommand('some command');

      expect(result).toEqual(['["incomplete array"']);
    });

    it('treats non-string array as single task', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '[1, 2, 3]',
          },
        ],
      });

      const result = await service.processCommand('some command');

      expect(result).toEqual(['[1, 2, 3]']);
    });

    it('treats mixed array as single task', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '["string", 123, "another"]',
          },
        ],
      });

      const result = await service.processCommand('some command');

      expect(result).toEqual(['["string", 123, "another"]']);
    });

    it('throws error for non-text response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'image',
            source: {},
          },
        ],
      });

      await expect(service.processCommand('some command')).rejects.toThrow(
        'Unexpected response type from Claude API'
      );
    });

    it('propagates API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(service.processCommand('some command')).rejects.toThrow(
        'API Error'
      );
    });

    it('trims whitespace from single task response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '  list all files in directory  ',
          },
        ],
      });

      const result = await service.processCommand('ls');

      expect(result).toEqual(['list all files in directory']);
    });

    it('handles empty array response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '[]',
          },
        ],
      });

      const result = await service.processCommand('some command');

      // Empty JSON array is treated as single task since it contains no strings
      expect(result).toEqual(['[]']);
    });
  });
});
