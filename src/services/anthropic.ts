import Anthropic from '@anthropic-ai/sdk';

import type { Task } from '../types/types.js';

import {
  AnthropicConfig,
  getAvailableConfigStructure,
  getConfiguredKeys,
  loadDebugSetting,
} from './configuration.js';
import {
  formatSkillsForComprehension,
  formatSkillsForPrompt,
  loadSkillsForComprehension,
  loadSkillsWithValidation,
} from './skills.js';
import { loadFragment, toolRegistry } from './tool-registry.js';

export interface ExecuteCommand {
  description: string;
  command: string;
  workdir?: string;
  timeout?: number;
  critical?: boolean;
}

export enum ComprehensionStatus {
  Core = 'core',
  Custom = 'custom',
  Unknown = 'unknown',
}

export interface ComprehensionItem {
  verb: string;
  context?: string;
  name?: string;
  status: ComprehensionStatus;
}

export interface ComprehensionResult {
  message: string;
  items: ComprehensionItem[];
}

export interface CommandResult {
  message: string;
  tasks: Task[];
  answer?: string;
  commands?: ExecuteCommand[];
  comprehension?: ComprehensionResult;
}

export interface LLMService {
  processWithTool(
    command: string,
    toolName: string,
    comprehensionResult?: ComprehensionResult
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

/**
 * Check if comprehension results contain any custom skills
 */
function hasCustomSkills(comprehension: ComprehensionResult): boolean {
  return comprehension.items.some(
    (item) => item.status === ComprehensionStatus.Custom
  );
}

/**
 * Check if comprehension results contain any core commands
 */
function hasCoreCommands(comprehension: ComprehensionResult): boolean {
  return comprehension.items.some(
    (item) => item.status === ComprehensionStatus.Core
  );
}

/**
 * Compose PLAN instructions from fragments based on comprehension results
 * Conditionally loads instruction fragments to optimize token usage:
 * - Core-only: 361 lines (48.7% reduction)
 * - Skills-only: 589 lines (16.3% reduction)
 * - Mixed: 704 lines (full instructions)
 */
function composePlanInstructions(comprehension: ComprehensionResult): string {
  const hasSkills = hasCustomSkills(comprehension);
  const hasCore = hasCoreCommands(comprehension);

  let instructions = '';

  // Always include foundation
  instructions += loadFragment('PLAN/foundation.md');
  instructions += loadFragment('PLAN/routing.md');
  instructions += loadFragment('PLAN/tasks.md');

  // Conditional config (only for core commands)
  if (hasCore) {
    instructions += loadFragment('PLAN/config.md');
  }

  // Always include splitting logic
  instructions += loadFragment('PLAN/splitting.md');

  // Conditional skills and examples
  if (hasSkills && hasCore) {
    // Mixed: all examples
    instructions += loadFragment('PLAN/skills.md');
    instructions += loadFragment('PLAN/examples-core.md');
    instructions += loadFragment('PLAN/examples-skills.md');
  } else if (hasSkills) {
    // Skills-only
    instructions += loadFragment('PLAN/skills.md');
    instructions += loadFragment('PLAN/examples-skills.md');
  } else {
    // Core-only
    instructions += loadFragment('PLAN/examples-core.md');
  }

  return instructions;
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
    toolName: string,
    comprehensionResult?: ComprehensionResult
  ): Promise<CommandResult> {
    // Load tool from registry
    const tool = toolRegistry.getSchema(toolName);
    const instructions = toolRegistry.getInstructions(toolName);

    // Build system prompt with additional context based on tool
    let systemPrompt = instructions;

    /**
     * Two-step workflow context loading:
     *
     * COMPREHEND tool: Load filtered skills (Name + Description only)
     * - Fast verb matching without full skill details
     * - Reduces token usage and improves response time
     *
     * Other tools (PLAN, etc): Load full skills with all sections
     * - Complete skill details for execution planning
     * - Includes Steps, Execution, Config, and Aliases sections
     */

    // Add skills section for comprehend tool (Name + Description only)
    if (toolName === 'comprehend') {
      const skills = loadSkillsForComprehension();
      const skillsSection = formatSkillsForComprehension(skills);
      systemPrompt += skillsSection;
    }

    // Add skills section for other applicable tools (full details)
    // Note: PLAN tool uses conditional fragment composition instead
    if (
      toolName === 'introspect' ||
      toolName === 'execute' ||
      toolName === 'validate'
    ) {
      const skills = loadSkillsWithValidation();
      const skillsSection = formatSkillsForPrompt(skills);
      systemPrompt += skillsSection;
    }

    // Add config structure for config tool only
    if (toolName === 'config') {
      const configStructure = getAvailableConfigStructure();
      const configuredKeys = getConfiguredKeys();
      const configSection =
        '\n\n## Available Configuration\n\n' +
        'Config structure (key: description):\n' +
        JSON.stringify(configStructure, null, 2) +
        '\n\nConfigured keys (keys that exist in config file):\n' +
        JSON.stringify(configuredKeys, null, 2);
      systemPrompt += configSection;
    }

    // Add debug mode flag for introspect tool
    if (toolName === 'introspect') {
      const debugMode = loadDebugSetting();
      const debugSection =
        '\n\n## Debug Mode\n\n' +
        `Debug mode is ${debugMode ? 'ENABLED' : 'DISABLED'}.\n` +
        (debugMode
          ? 'Include built-in workflow tools in the listing: Comprehend, Plan, Validate, Report.\n'
          : 'Do NOT include built-in workflow tools in the listing.\n');
      systemPrompt += debugSection;
    }

    /**
     * PLAN tool with fragment composition:
     *
     * The COMPREHEND tool has already categorized requests and matched verbs.
     * PLAN uses conditional fragment composition to optimize token usage:
     * - Core-only: Loads only core instruction fragments (48.7% reduction)
     * - Skills-only: Loads skills fragments without core examples (16.3% reduction)
     * - Mixed: Loads all fragments (full instructions)
     *
     * This optimization significantly reduces latency for common CLI use cases
     * (explain, list skills, config) while maintaining full capability.
     */

    // PLAN tool: Compose instructions from fragments and add comprehension results
    if (toolName === 'plan' && comprehensionResult) {
      // Replace base instructions with composed fragments
      systemPrompt = composePlanInstructions(comprehensionResult);

      // Add comprehension results section
      const comprehensionSection =
        '\n\n## Comprehension Results\n\n' +
        'The COMPREHEND tool has already matched verbs to capabilities:\n\n' +
        JSON.stringify(comprehensionResult.items, null, 2) +
        '\n\n**CRITICAL REQUIREMENT**: For each comprehension item, you MUST handle it as follows:\n\n' +
        '- **status "unknown"**: You MUST create a task with type "ignore" and action "Ignore unknown \'X\' request" where X is the full command (verb + context).\n' +
        '  - This is MANDATORY - every unknown command MUST result in an ignore task\n' +
        '  - DO NOT skip unknown commands\n' +
        '  - DO NOT try to execute or plan unknown commands\n' +
        '  - Example: verb "test", context "files" with status "unknown" → task with type "ignore", action "Ignore unknown \'test files\' request"\n\n' +
        '- **status "core"**: Use name field to determine which core tool to invoke (Answer, Execute, Config, or Introspect). The context field provides the subject.\n\n' +
        '- **status "custom"**: Use name field to identify the skill, and context field for the subject. Analyze variants and create execution tasks from that skill\'s steps\n';
      systemPrompt += comprehensionSection;

      // Conditionally add skills if custom skills present
      if (hasCustomSkills(comprehensionResult)) {
        const skills = loadSkillsWithValidation();
        const skillsSection = formatSkillsForPrompt(skills);
        systemPrompt += skillsSection;
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
          answer: cleanAnswerText(textContent.text),
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
      items?: ComprehensionItem[];
    };

    // Handle comprehend tool response
    if (toolName === 'comprehend') {
      if (input.message === undefined || typeof input.message !== 'string') {
        throw new Error(
          'Invalid tool response: missing or invalid message field'
        );
      }

      if (!input.items || !Array.isArray(input.items)) {
        throw new Error(
          'Invalid tool response: missing or invalid items array'
        );
      }

      // Validate each item
      input.items.forEach((item, i) => {
        if (!item.verb || typeof item.verb !== 'string') {
          throw new Error(
            `Invalid item at index ${String(i)}: missing or invalid 'verb' field`
          );
        }
        const validStatuses = Object.values(ComprehensionStatus);
        if (!validStatuses.includes(item.status)) {
          throw new Error(
            `Invalid item at index ${String(i)}: missing or invalid 'status' field`
          );
        }
      });

      return {
        message: input.message,
        tasks: [],
        comprehension: {
          message: input.message,
          items: input.items,
        },
      };
    }

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
        answer: cleanAnswerText(input.answer),
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
