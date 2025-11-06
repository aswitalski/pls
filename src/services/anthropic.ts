import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import Anthropic from '@anthropic-ai/sdk';

import { AnthropicConfig } from './config.js';
import { loadSkills, formatSkillsForPrompt } from './skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CommandResult {
  tasks: string[];
  systemPrompt?: string;
}

export interface LLMService {
  processCommand(command: string): Promise<CommandResult>;
}

const PLAN_PROMPT = readFileSync(join(__dirname, '../config/PLAN.md'), 'utf-8');

export class AnthropicService implements LLMService {
  private client: Anthropic;
  private model: string;

  constructor(key: string, model = 'claude-haiku-4-5-20251001') {
    this.client = new Anthropic({ apiKey: key });
    this.model = model;
  }

  async processCommand(command: string): Promise<CommandResult> {
    // Load skills and augment the planning prompt
    const skills = loadSkills();
    const skillsSection = formatSkillsForPrompt(skills);
    const systemPrompt = PLAN_PROMPT + skillsSection;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: command,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const text = content.text.trim();

    let tasks: string[];

    // Try to parse as JSON array
    if (text.startsWith('[') && text.endsWith(']')) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) {
          // Validate all items are strings
          const allStrings = parsed.every((item) => typeof item === 'string');
          if (allStrings) {
            tasks = parsed.filter(
              (item): item is string => typeof item === 'string'
            );
          } else {
            tasks = [text];
          }
        } else {
          tasks = [text];
        }
      } catch {
        // If JSON parsing fails, treat as single task
        tasks = [text];
      }
    } else {
      // Single task
      tasks = [text];
    }

    const isDebug = process.env.DEBUG === 'true';
    return {
      tasks,
      systemPrompt: isDebug ? systemPrompt : undefined,
    };
  }
}

export function createAnthropicService(
  config: AnthropicConfig
): AnthropicService {
  return new AnthropicService(config.key, config.model);
}
