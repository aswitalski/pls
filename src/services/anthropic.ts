import Anthropic from '@anthropic-ai/sdk';

import { AnthropicConfig } from './config.js';
import { loadSkills, formatSkillsForPrompt } from './skills.js';
import { toolRegistry } from './tool-registry.js';
import type { Task } from '../types/components.js';

export interface CommandResult {
  tasks: Task[];
  systemPrompt?: string;
}

export interface LLMService {
  processWithTool(command: string, toolName: string): Promise<CommandResult>;
}

export class AnthropicService implements LLMService {
  private client: Anthropic;
  private model: string;

  constructor(key: string, model = 'claude-haiku-4-5-20251001') {
    this.client = new Anthropic({ apiKey: key });
    this.model = model;
  }

  async processWithTool(
    command: string,
    toolName: string
  ): Promise<CommandResult> {
    // Load tool from registry
    const tool = toolRegistry.getSchema(toolName);
    const instructions = toolRegistry.getInstructions(toolName);

    // Load skills and augment the instructions
    const skills = loadSkills();
    const skillsSection = formatSkillsForPrompt(skills);
    const systemPrompt = instructions + skillsSection;

    // Call API with tool
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: 'any' },
      messages: [
        {
          role: 'user',
          content: command,
        },
      ],
    });

    // Check for truncation
    if (response.stop_reason === 'max_tokens') {
      throw new Error(
        'Response was truncated due to length. Please simplify your request or break it into smaller parts.'
      );
    }

    // Validate response structure
    if (
      response.content.length === 0 ||
      response.content[0].type !== 'tool_use'
    ) {
      throw new Error('Expected tool_use response from Claude API');
    }
    const content = response.content[0];

    // Extract and validate tasks array
    const input = content.input as { tasks?: Task[] };
    if (!input.tasks || !Array.isArray(input.tasks)) {
      throw new Error('Invalid tool response: missing or invalid tasks array');
    }

    // Validate each task has required action field
    input.tasks.forEach((task, i) => {
      if (!task.action || typeof task.action !== 'string') {
        throw new Error(
          `Invalid task at index ${String(i)}: missing or invalid 'action' field`
        );
      }
    });

    const isDebug = process.env.DEBUG === 'true';
    return {
      tasks: input.tasks,
      systemPrompt: isDebug ? systemPrompt : undefined,
    };
  }
}

export function createAnthropicService(
  config: AnthropicConfig
): AnthropicService {
  return new AnthropicService(config.key, config.model);
}
