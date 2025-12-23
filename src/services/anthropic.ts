import Anthropic from '@anthropic-ai/sdk';

import type { Capability, ComponentDefinition } from '../types/components.js';
import type { Task } from '../types/types.js';

import {
  AnthropicConfig,
  getAvailableConfigStructure,
  getConfiguredKeys,
} from './configuration.js';
import { logPrompt, logResponse } from './logger.js';
import { formatSkillsForPrompt, loadSkillsWithValidation } from './skills.js';
import { toolRegistry } from './registry.js';

export interface ExecuteCommand {
  description: string;
  command: string;
  workdir?: string;
  timeout?: number;
  critical?: boolean;
}

export interface CommandResult {
  message: string;
  summary?: string;
  tasks: Task[];
  answer?: string;
  commands?: ExecuteCommand[];
  debug?: ComponentDefinition[];
}

export interface IntrospectResult {
  message: string;
  capabilities: Capability[];
  debug?: ComponentDefinition[];
}

export interface LLMService {
  processWithTool(
    command: string,
    toolName: 'introspect',
    instructions?: string
  ): Promise<IntrospectResult>;
  processWithTool(
    command: string,
    toolName: string,
    instructions?: string
  ): Promise<CommandResult>;
}

/**
 * Wraps text to ensure no line exceeds the specified width.
 * Breaks at word boundaries to maintain readability.
 */
function wrapText(text: string, maxWidth: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    // If adding this word would exceed max width, start a new line
    if (
      currentLine.length > 0 &&
      currentLine.length + 1 + word.length > maxWidth
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    }
  }

  // Add the last line if not empty
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Removes citation tags and other markup from answer text.
 * Web search responses may include <cite> tags that should be stripped.
 * Also wraps text to ensure lines don't exceed 80 characters.
 */
export function cleanAnswerText(text: string): string {
  // Remove citation tags like <cite index="1-1">content</cite>
  // Replace with just the content
  let cleaned = text.replace(/<cite[^>]*>(.*?)<\/cite>/g, '$1');

  // Remove any other XML/HTML tags that might appear
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Normalize whitespace, converting all whitespace to single spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Wrap text to 80 characters per line
  cleaned = wrapText(cleaned, 80);

  return cleaned;
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
    toolName: 'introspect',
    customInstructions?: string
  ): Promise<IntrospectResult>;
  async processWithTool(
    command: string,
    toolName: string,
    customInstructions?: string
  ): Promise<CommandResult>;
  async processWithTool(
    command: string,
    toolName: string,
    customInstructions?: string
  ): Promise<CommandResult | IntrospectResult> {
    // Load tool from registry
    const tool = toolRegistry.getSchema(toolName);

    // Use custom instructions if provided, otherwise load from registry
    let systemPrompt: string;

    if (customInstructions) {
      // Custom instructions provided (typically for testing)
      systemPrompt = customInstructions;
    } else {
      // Load and build system prompt automatically (production)
      const instructions = toolRegistry.getInstructions(toolName);
      systemPrompt = instructions;

      // Add skills section for applicable tools
      if (
        toolName === 'schedule' ||
        toolName === 'introspect' ||
        toolName === 'execute' ||
        toolName === 'validate'
      ) {
        const skills = loadSkillsWithValidation();
        const skillsSection = formatSkillsForPrompt(skills);
        systemPrompt += skillsSection;
      }

      // Add config structure for configure tool only
      if (toolName === 'configure') {
        const configStructure = getAvailableConfigStructure();
        const configuredKeys = getConfiguredKeys();
        const configSection =
          '\n## Available Configuration\n\n' +
          'Config structure (key: description):\n' +
          JSON.stringify(configStructure, null, 2) +
          '\n\nConfigured keys (keys that exist in config file):\n' +
          JSON.stringify(configuredKeys, null, 2);
        systemPrompt += configSection;
      }
    }

    // Build tools array - add web search for answer tool
    const tools: (Anthropic.Tool | Anthropic.WebSearchTool20250305)[] = [tool];
    if (toolName === 'answer') {
      tools.push({
        type: 'web_search_20250305',
        name: 'web_search',
      });
    }

    // Collect debug components
    const debug: ComponentDefinition[] = [];

    // Log prompt at Verbose level
    const promptDebug = logPrompt(toolName, command, systemPrompt);
    if (promptDebug) {
      debug.push(promptDebug);
    }

    // Call API with tool
    const startTime = Date.now();
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
    const duration = Date.now() - startTime;

    // Log response at Verbose level
    const responseDebug = logResponse(toolName, response, duration);
    if (responseDebug) {
      debug.push(responseDebug);
    }

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
          answer: cleanAnswerText(textContent.text),
          debug,
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
      summary?: string;
      tasks?: Task[];
      capabilities?: Capability[];
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
        summary: input.summary,
        tasks: [],
        commands: input.commands,
        debug,
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
        answer: cleanAnswerText(input.answer),
        debug,
      };
    }

    // Handle introspect tool response
    if (toolName === 'introspect') {
      if (!input.message || typeof input.message !== 'string') {
        throw new Error(
          'Invalid tool response: missing or invalid message field'
        );
      }

      if (!input.capabilities || !Array.isArray(input.capabilities)) {
        throw new Error(
          'Invalid tool response: missing or invalid capabilities array'
        );
      }

      // Validate each capability has required fields
      input.capabilities.forEach((cap, i) => {
        if (!cap.name || typeof cap.name !== 'string') {
          throw new Error(
            `Invalid capability at index ${String(i)}: missing or invalid 'name' field`
          );
        }
        if (!cap.description || typeof cap.description !== 'string') {
          throw new Error(
            `Invalid capability at index ${String(i)}: missing or invalid 'description' field`
          );
        }
        if (typeof cap.origin !== 'string') {
          throw new Error(
            `Invalid capability at index ${String(i)}: invalid 'origin' field`
          );
        }
      });

      return {
        message: input.message,
        capabilities: input.capabilities,
        debug,
      };
    }

    // Handle schedule tool responses
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
      debug,
    };
  }
}

export function createAnthropicService(
  config: AnthropicConfig
): AnthropicService {
  return new AnthropicService(config.key, config.model);
}
