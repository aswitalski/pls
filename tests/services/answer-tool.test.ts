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

    expect(result.answer).toBe(multiLineAnswer);
    expect(result.answer?.split('\n')).toHaveLength(4);
  });
});
