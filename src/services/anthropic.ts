import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AnthropicService {
  processCommand(rawCommand: string): Promise<string[]>;
}

const PLAN_PROMPT = readFileSync(
  join(__dirname, '../config/PLAN.md'),
  'utf-8'
);

export class AnthropicService implements AnthropicService {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-haiku-4-5-20251001') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async processCommand(rawCommand: string): Promise<string[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 200,
      system: PLAN_PROMPT,
      messages: [
        {
          role: 'user',
          content: rawCommand,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const text = content.text.trim();

    // Try to parse as JSON array
    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate all items are strings
          const allStrings = parsed.every((item) => typeof item === 'string');
          if (allStrings) {
            return parsed.filter(
              (item): item is string => typeof item === 'string'
            );
          }
        }
      } catch {
        // If JSON parsing fails, treat as single task
      }
    }

    // Single task
    return [text];
  }
}

export function createAnthropicService(
  apiKey: string,
  model?: string
): AnthropicService {
  return new AnthropicService(apiKey, model);
}
