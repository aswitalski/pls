import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicService } from '../src/services/anthropic.js';
import Anthropic from '@anthropic-ai/sdk';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(),
  };
});

// Mock the skills service
vi.mock('../src/services/skills.js', () => {
  return {
    loadSkills: vi.fn(() => []),
    formatSkillsForPrompt: vi.fn(() => ''),
  };
});

describe('AnthropicService - Tool-based processing', () => {
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

  describe('processWithTool', () => {
    it('returns structured tasks for single task', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'plan',
            input: {
              tasks: [
                {
                  action: 'change directory to the home folder',
                  type: 'execute',
                  params: { command: 'cd ~' },
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool('change dir to ~', 'plan');

      expect(result.tasks).toEqual([
        {
          action: 'change directory to the home folder',
          type: 'execute',
          params: { command: 'cd ~' },
        },
      ]);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          tools: expect.any(Array) as unknown[],
          tool_choice: { type: 'any' },
        })
      );
    });

    it('returns structured tasks for multiple tasks', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_456',
            name: 'plan',
            input: {
              tasks: [
                {
                  action: 'install dependencies',
                  type: 'execute',
                  params: { command: 'npm install' },
                },
                {
                  action: 'run tests',
                  type: 'execute',
                  params: { command: 'npm test' },
                },
                {
                  action: 'deploy application',
                  type: 'execute',
                  params: { command: 'npm run deploy' },
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool(
        'install deps, run tests, deploy',
        'plan'
      );

      expect(result.tasks).toEqual([
        {
          action: 'install dependencies',
          type: 'execute',
          params: { command: 'npm install' },
        },
        {
          action: 'run tests',
          type: 'execute',
          params: { command: 'npm test' },
        },
        {
          action: 'deploy application',
          type: 'execute',
          params: { command: 'npm run deploy' },
        },
      ]);
    });

    it('handles tasks with optional fields', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_789',
            name: 'plan',
            input: {
              tasks: [
                {
                  action: 'list files',
                },
                {
                  action: 'create directory',
                  type: 'execute',
                },
                {
                  action: 'install package',
                  type: 'execute',
                  params: { command: 'npm install lodash' },
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool('some command', 'plan');

      expect(result.tasks).toEqual([
        {
          action: 'list files',
        },
        {
          action: 'create directory',
          type: 'execute',
        },
        {
          action: 'install package',
          type: 'execute',
          params: { command: 'npm install lodash' },
        },
      ]);
    });

    it('handles complex nested params', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_complex',
            name: 'plan',
            input: {
              tasks: [
                {
                  action: 'fetch API data',
                  type: 'execute',
                  params: {
                    url: 'https://api.example.com/data',
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: 'Bearer token',
                    },
                    body: {
                      query: 'test',
                      filters: ['active', 'recent'],
                    },
                  },
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool('fetch data', 'plan');

      expect(result.tasks[0].params).toEqual({
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        },
        body: {
          query: 'test',
          filters: ['active', 'recent'],
        },
      });
    });

    it('throws error for non-tool_use response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This should be a tool use',
          },
        ],
        stop_reason: 'end_turn',
      });

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow('Expected tool_use response from Claude API');
    });

    it('throws error for missing tasks array', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_bad',
            name: 'plan',
            input: {
              // Missing tasks array
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow(
        'Invalid tool response: missing or invalid tasks array'
      );
    });

    it('propagates API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow('API Error');
    });

    it('handles empty tasks array', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_empty',
            name: 'plan',
            input: {
              tasks: [],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool('do nothing', 'plan');

      expect(result.tasks).toEqual([]);
    });
  });

  describe('Metadata support', () => {
    it('includes type and params in task definitions', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_test',
            name: 'plan',
            input: {
              tasks: [
                {
                  action: 'install dependencies',
                  type: 'execute',
                  params: { command: 'npm install' },
                },
              ],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      const result = await service.processWithTool('install deps', 'plan');

      expect(result.tasks[0]).toHaveProperty('action', 'install dependencies');
      expect(result.tasks[0]).toHaveProperty('type', 'execute');
      expect(result.tasks[0]).toHaveProperty('params');
      expect(result.tasks[0].params).toEqual({ command: 'npm install' });
    });
  });

  describe('Error handling', () => {
    it('throws error when response is truncated', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_truncated',
            name: 'plan',
            input: {
              tasks: [{ action: 'partial task' }],
            },
          },
        ],
        stop_reason: 'max_tokens',
      });

      await expect(
        service.processWithTool('complex command', 'plan')
      ).rejects.toThrow(
        'Response was truncated due to length. Please simplify your request or break it into smaller parts.'
      );
    });

    it('throws error when content is missing', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        stop_reason: 'end_turn',
      });

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow('Expected tool_use response from Claude API');
    });

    it('throws error when task is missing action field', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_bad',
            name: 'plan',
            input: {
              tasks: [{ type: 'execute' }],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow(
        "Invalid task at index 0: missing or invalid 'action' field"
      );
    });

    it('throws error when task is not an object', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_bad',
            name: 'plan',
            input: {
              tasks: ['string task'],
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow(
        "Invalid task at index 0: missing or invalid 'action' field"
      );
    });

    it('throws error when tasks field is not an array', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_bad',
            name: 'plan',
            input: {
              tasks: 'not an array',
            },
          },
        ],
        stop_reason: 'end_turn',
      });

      await expect(
        service.processWithTool('some command', 'plan')
      ).rejects.toThrow(
        'Invalid tool response: missing or invalid tasks array'
      );
    });
  });
});
