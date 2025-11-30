import { describe, expect, it, vi } from 'vitest';

import { AnthropicService } from '../../src/services/anthropic.js';

describe('Answer tool response handling', () => {
  it('correctly processes answer tool response', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                question: 'What is the price of Samsung The Frame 55 inch?',
                answer:
                  'The 55 inch Samsung The Frame TV costs around $1,500.\nIt features a QLED display with 4K resolution.\nThe Frame includes customizable bezels and Art Mode.\nAvailable at major retailers like Best Buy and Amazon.',
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    // Replace the client with mock
    (service as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await service.processWithTool(
      'Find price of Samsung The Frame 55 inch',
      'answer'
    );

    expect(result.answer).toBeDefined();
    expect(result.answer).toContain('$1,500');
    expect(result.answer).toContain('QLED display');
    expect(result.message).toBe('');
    expect(result.tasks).toEqual([]);
  });

  it('validates answer tool response has question field', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                answer: 'Some answer without question field',
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await expect(
      service.processWithTool('What is TypeScript?', 'answer')
    ).rejects.toThrow('missing or invalid question field');
  });

  it('validates answer tool response has answer field', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                question: 'What is TypeScript?',
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await expect(
      service.processWithTool('What is TypeScript?', 'answer')
    ).rejects.toThrow('missing or invalid answer field');
  });

  it('rejects answer tool response with non-string question', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                question: 123, // Invalid: should be string
                answer: 'Some answer',
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await expect(
      service.processWithTool('What is TypeScript?', 'answer')
    ).rejects.toThrow('missing or invalid question field');
  });

  it('rejects answer tool response with non-string answer', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                question: 'What is TypeScript?',
                answer: ['Invalid', 'array'], // Invalid: should be string
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await expect(
      service.processWithTool('What is TypeScript?', 'answer')
    ).rejects.toThrow('missing or invalid answer field');
  });

  it('processes multi-line answers correctly', async () => {
    const multiLineAnswer = `TypeScript is a programming language that adds static typing to JavaScript.
It helps catch errors during development and improves code maintainability.
TypeScript code compiles to JavaScript and runs anywhere JavaScript runs.
The type system provides better tooling and IDE support.`;

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                question: 'What is TypeScript?',
                answer: multiLineAnswer,
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await service.processWithTool(
      'What is TypeScript?',
      'answer'
    );

    // Answer should be wrapped to 80 characters per line
    const lines = result.answer?.split('\n') ?? [];
    expect(lines.every((line) => line.length <= 80)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);

    // Should contain all the key content
    expect(result.answer).toContain('TypeScript is a programming language');
    expect(result.answer).toContain('static typing');
    expect(result.answer).toContain('catch errors during development');
    expect(result.answer).toContain('type system provides better tooling');
  });
});

describe('Web search integration', () => {
  it('includes web search tool for answer requests', async () => {
    let capturedTools: unknown[] = [];

    const mockClient = {
      messages: {
        create: vi.fn().mockImplementation((params: { tools: unknown[] }) => {
          capturedTools = params.tools;
          return Promise.resolve({
            stop_reason: 'end_turn',
            content: [
              {
                type: 'tool_use',
                input: {
                  question: 'What time is it?',
                  answer: 'The current time is 3:45 PM.',
                },
              },
            ],
          });
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await service.processWithTool('What time is it?', 'answer');

    expect(capturedTools).toHaveLength(2);
    expect(capturedTools[1]).toEqual({
      type: 'web_search_20250305',
      name: 'web_search',
    });
  });

  it('handles text response when model returns directly after web search', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'web_search_tool_result',
              search_results: [
                { title: 'Current Time', url: 'https://time.is' },
              ],
            },
            {
              type: 'text',
              text: 'The current time is 3:45 PM EST.',
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await service.processWithTool('What time is it?', 'answer');

    expect(result.answer).toBe('The current time is 3:45 PM EST.');
    expect(result.message).toBe('');
    expect(result.tasks).toEqual([]);
  });

  it('finds tool_use after web search results', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'web_search_tool_result',
              search_results: [
                { title: 'Weather Report', url: 'https://weather.com' },
              ],
            },
            {
              type: 'tool_use',
              input: {
                question: 'What is the weather in NYC?',
                answer: 'Currently 72°F and sunny in New York City.',
              },
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    const result = await service.processWithTool(
      'What is the weather in NYC?',
      'answer'
    );

    expect(result.answer).toBe('Currently 72°F and sunny in New York City.');
  });

  it('does not include web search tool for plan requests', async () => {
    let capturedTools: unknown[] = [];

    const mockClient = {
      messages: {
        create: vi.fn().mockImplementation((params: { tools: unknown[] }) => {
          capturedTools = params.tools;
          return Promise.resolve({
            stop_reason: 'end_turn',
            content: [
              {
                type: 'tool_use',
                input: {
                  message: 'Here is the plan.',
                  tasks: [{ action: 'Test action', type: 'execute' }],
                },
              },
            ],
          });
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await service.processWithTool('do something', 'plan');

    expect(capturedTools).toHaveLength(1);
  });

  it('throws error when no tool_use or text content for answer', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'web_search_tool_result',
              search_results: [],
            },
          ],
        }),
      },
    };

    const service = new AnthropicService(
      'sk-ant-api03-' + 'A'.repeat(95),
      'claude-haiku-4-5-20251001'
    );

    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await expect(
      service.processWithTool('What time is it?', 'answer')
    ).rejects.toThrow('Expected tool_use response from Claude API');
  });
});
