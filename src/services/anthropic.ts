import Anthropic from '@anthropic-ai/sdk';

import type { Task } from '../types/types.js';

import {
  AnthropicConfig,
  getAvailableConfigStructure,
} from './configuration.js';
import { formatSkillsForPrompt, loadSkills } from './skills.js';
import { toolRegistry } from './tool-registry.js';

export interface ExecuteCommand {
  description: string;
  command: string;
  workdir?: string;
  timeout?: number;
  critical?: boolean;
}

export interface CommandResult {
  message: string;
  tasks: Task[];
  answer?: string;
  commands?: ExecuteCommand[];
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

    // Build system prompt with additional context based on tool
    let systemPrompt = instructions;

    // Add skills section for applicable tools
    if (
      toolName === 'plan' ||
      toolName === 'introspect' ||
      toolName === 'execute' ||
      toolName === 'validate'
    ) {
      const skills = loadSkills();
      const skillsSection = formatSkillsForPrompt(skills);
      systemPrompt += skillsSection;
    }

    // Add config structure for config tool only
    if (toolName === 'config') {
      const configStructure = getAvailableConfigStructure();
      const configSection =
        '\n\n## Available Configuration\n\n' +
        'Config structure (key: description):\n' +
        JSON.stringify(configStructure, null, 2);
      systemPrompt += configSection;
    }

    // Build tools array - add web search for answer tool
    const tools: (Anthropic.Tool | Anthropic.WebSearchTool20250305)[] = [tool];
    if (toolName === 'answer') {
      tools.push({
        type: 'web_search_20250305',
        name: 'web_search',
      });
    }

    // Call API with tool
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
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

    // Find tool_use block in response (may not be first with web search)
    const toolUseContent = response.content.find(
      (block) => block.type === 'tool_use'
    );

    // For answer tool with web search, model might return text directly
    if (toolName === 'answer' && !toolUseContent) {
      const textContent = response.content.find(
        (block) => block.type === 'text'
      );
      if (textContent) {
        return {
          message: '',
          tasks: [],
          answer: textContent.text,
        };
      }
    }

    if (!toolUseContent) {
      throw new Error('Expected tool_use response from Claude API');
    }
    const content = toolUseContent;

    // Extract and validate response based on tool type
    const input = content.input as {
      message?: string;
      tasks?: Task[];
      question?: string;
      answer?: string;
      commands?: ExecuteCommand[];
    };

    // Handle execute tool response
    if (toolName === 'execute') {
      if (!input.message || typeof input.message !== 'string') {
        throw new Error(
          'Invalid tool response: missing or invalid message field'
        );
      }

      if (!input.commands || !Array.isArray(input.commands)) {
        throw new Error(
          'Invalid tool response: missing or invalid commands array'
        );
      }

      // Validate each command has required fields
      input.commands.forEach((cmd, i) => {
        if (!cmd.description || typeof cmd.description !== 'string') {
          throw new Error(
            `Invalid command at index ${String(i)}: missing or invalid 'description' field`
          );
        }
        if (!cmd.command || typeof cmd.command !== 'string') {
          throw new Error(
            `Invalid command at index ${String(i)}: missing or invalid 'command' field`
          );
        }
      });

      return {
        message: input.message,
        tasks: [],
        commands: input.commands,
      };
    }

    // Handle answer tool response
    if (toolName === 'answer') {
      if (!input.question || typeof input.question !== 'string') {
        throw new Error(
          'Invalid tool response: missing or invalid question field'
        );
      }

      if (!input.answer || typeof input.answer !== 'string') {
        throw new Error(
          'Invalid tool response: missing or invalid answer field'
        );
      }

      return {
        message: '',
        tasks: [],
        answer: input.answer,
      };
    }

    // Handle plan and introspect tool responses
    if (input.message === undefined || typeof input.message !== 'string') {
      throw new Error(
        'Invalid tool response: missing or invalid message field'
      );
    }

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

    return {
      message: input.message,
      tasks: input.tasks,
    };
  }
}

export function createAnthropicService(
  config: AnthropicConfig
): AnthropicService {
  return new AnthropicService(config.key, config.model);
}
