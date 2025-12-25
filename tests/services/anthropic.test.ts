import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnthropicService,
  cleanAnswerText,
} from '../../src/services/anthropic.js';
import {
  hasValidAnthropicKey,
  saveAnthropicConfig,
} from '../../src/services/configuration.js';

import { safeRemoveDirectory } from '../test-utils.js';

describe('Anthropic API key validation', () => {
  let originalHome: string | undefined;
  let tempHome: string;

  beforeEach(() => {
    originalHome = process.env.HOME;
    tempHome = join(
      tmpdir(),

      `pls-anthropic-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tempHome, { recursive: true });
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    safeRemoveDirectory(tempHome);
  });

  describe('Valid API keys', () => {
    it('accepts valid API key with uppercase letters', () => {
      const validKey = 'sk-ant-api03-' + 'A'.repeat(95);

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with lowercase letters', () => {
      const validKey = 'sk-ant-api03-' + 'a'.repeat(95);

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with digits', () => {
      const validKey = 'sk-ant-api03-' + '0123456789'.repeat(9) + '01234';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with hyphens', () => {
      const validKey = 'sk-ant-api03-' + 'A-'.repeat(47) + 'A';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with underscores', () => {
      const validKey = 'sk-ant-api03-' + 'A_'.repeat(47) + 'A';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });

    it('accepts valid API key with mixed characters', () => {
      const validKey = 'sk-ant-api03-' + 'aB3-xY9_Z'.repeat(10) + 'mN2-p';

      saveAnthropicConfig({
        key: validKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(true);
    });
  });

  describe('Invalid API keys', () => {
    it('rejects invalid API key format without sk-ant-api03- prefix', () => {
      saveAnthropicConfig({
        key: 'invalid-key-format',
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key with old sk-ant- prefix format', () => {
      saveAnthropicConfig({
        key: 'sk-ant-' + 'A'.repeat(95),
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key that is too short', () => {
      saveAnthropicConfig({
        key: 'sk-ant-api03-',
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key that is too long', () => {
      const tooLongKey = 'sk-ant-api03-' + 'A'.repeat(96);
      saveAnthropicConfig({
        key: tooLongKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects API key with special characters in body', () => {
      const invalidKey = 'sk-ant-api03-' + 'A'.repeat(90) + '@#$%^';
      expect(invalidKey.length).toBe(108);

      saveAnthropicConfig({
        key: invalidKey,
        model: 'claude-haiku-4-5-20251001',
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });

    it('rejects empty API key', () => {
      expect(() =>
        saveAnthropicConfig({
          key: '',
          model: 'claude-haiku-4-5-20251001',
        })
      ).toThrow('Missing or invalid API key');
    });

    it('rejects API key with correct length but wrong prefix', () => {
      const wrongPrefix = 'sk-wrong-api-' + 'A'.repeat(95);
      saveAnthropicConfig({
        key: wrongPrefix,
      });

      const result = hasValidAnthropicKey();
      expect(result).toBe(false);
    });
  });
});

describe('Answer text cleaning', () => {
  it('removes simple citation tags', () => {
    const input = '<cite index="1-1">Some content</cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe('Some content');
  });

  it('removes multiple citation tags', () => {
    const input =
      '<cite index="1-1">First</cite> and <cite index="2-1">second</cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe('First and second');
  });

  it('removes citation tags from complex text', () => {
    const input =
      '<cite index="1-1">Rumination is the focused attention on the symptoms of one\'s mental distress.</cite> <cite index="2-1">It involves repetitive thinking or dwelling on negative feelings and distress and their causes and consequences.</cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe(
      "Rumination is the focused attention on the symptoms of one's mental distress. It\ninvolves repetitive thinking or dwelling on negative feelings and distress and\ntheir causes and consequences."
    );
  });

  it('removes other HTML/XML tags', () => {
    const input = '<strong>Bold text</strong> and <em>italic text</em>';
    const result = cleanAnswerText(input);
    expect(result).toBe('Bold text and italic text');
  });

  it('normalizes whitespace', () => {
    const input = 'Some    text   with   extra    spaces';
    const result = cleanAnswerText(input);
    expect(result).toBe('Some text with extra spaces');
  });

  it('handles text without any tags', () => {
    const input = 'Plain text without any markup';
    const result = cleanAnswerText(input);
    expect(result).toBe('Plain text without any markup');
  });

  it('handles empty string', () => {
    const input = '';
    const result = cleanAnswerText(input);
    expect(result).toBe('');
  });

  it('handles nested tags', () => {
    const input = '<cite index="1-1"><strong>Bold citation</strong></cite>';
    const result = cleanAnswerText(input);
    expect(result).toBe('Bold citation');
  });

  it('wraps long lines to 80 characters', () => {
    const input =
      'This is a very long line that exceeds eighty characters and should be wrapped to multiple lines for better readability in the terminal.';
    const result = cleanAnswerText(input);
    const lines = result.split('\n');
    expect(lines.every((line) => line.length <= 80)).toBe(true);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('combines citation tags and wraps text', () => {
    const input = `<cite index="1-1">First line with some content</cite>
<cite index="2-1">Second line with more content</cite>
<cite index="3-1">Third line with additional content</cite>`;
    const result = cleanAnswerText(input);
    const lines = result.split('\n');
    // All lines should be <= 80 chars
    expect(lines.every((line) => line.length <= 80)).toBe(true);
    // Should contain all the content (may be wrapped across lines)
    expect(result).toContain('First line with some content');
    expect(result).toContain('Second line with more content');
    expect(result).toContain('Third line with');
    expect(result).toContain('additional content');
  });
});

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

describe('Introspect tool response handling', () => {
  it('validates capability has name field', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                message: 'Here are my capabilities:',
                capabilities: [
                  {
                    description: 'run commands',
                    origin: 'system',
                  },
                ],
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
      service.processWithTool('list skills', 'introspect')
    ).rejects.toThrow("missing or invalid 'name' field");
  });

  it('validates capability has description field', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                message: 'Here are my capabilities:',
                capabilities: [
                  {
                    name: 'Execute',
                    origin: 'system',
                  },
                ],
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
      service.processWithTool('list skills', 'introspect')
    ).rejects.toThrow("missing or invalid 'description' field");
  });

  it('validates capability has valid origin field', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                message: 'Here are my capabilities:',
                capabilities: [
                  {
                    name: 'Execute',
                    description: 'run commands',
                    origin: 123,
                  },
                ],
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
      service.processWithTool('list skills', 'introspect')
    ).rejects.toThrow("invalid 'origin' field");
  });

  it('rejects capability with non-string name', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                message: 'Here are my capabilities:',
                capabilities: [
                  {
                    name: ['Execute'],
                    description: 'run commands',
                    origin: 'system',
                  },
                ],
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
      service.processWithTool('list skills', 'introspect')
    ).rejects.toThrow("missing or invalid 'name' field");
  });

  it('rejects capability with non-string description', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'tool_use',
              input: {
                message: 'Here are my capabilities:',
                capabilities: [
                  {
                    name: 'Execute',
                    description: 42,
                    origin: 'system',
                  },
                ],
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
      service.processWithTool('list skills', 'introspect')
    ).rejects.toThrow("missing or invalid 'description' field");
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

  it('does not include web search tool for schedule requests', async () => {
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

    await service.processWithTool('do something', 'schedule');

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
