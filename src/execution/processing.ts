import { stringify } from 'yaml';

import { Task } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';
import { loadUserConfig } from '../services/loader.js';
import { replacePlaceholders } from '../services/resolver.js';

import { TaskProcessingResult } from './types.js';
import { validatePlaceholderResolution } from './validation.js';

/**
 * Fix escaped quotes in commands
 * JSON parsing removes backslashes before quotes in patterns like key="value"
 * This restores them: key="value" -> key=\"value\"
 */
export function fixEscapedQuotes(command: string): string {
  // Replace ="value" with =\"value\"
  return command.replace(/="([^"]*)"/g, '=\\"$1\\"');
}

/**
 * Format a task as YAML with action line and metadata block
 */
export function formatTaskAsYaml(
  action: string,
  metadata?: Record<string, unknown>,
  indent = ''
): string {
  const normalizedAction = action.charAt(0).toLowerCase() + action.slice(1);

  if (!metadata || Object.keys(metadata).length === 0) {
    return normalizedAction;
  }

  const metadataYaml = stringify({ metadata })
    .trim()
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');

  return `${normalizedAction}\n\n${metadataYaml}`;
}

/**
 * Build task descriptions for the LLM
 * Single task: use as-is; multiple tasks: add header and bullet prefix
 */
function buildTaskDescriptions(
  resolvedTasks: Array<{ action: string; params?: Record<string, unknown> }>
): string {
  if (resolvedTasks.length === 1) {
    const { action, params } = resolvedTasks[0];
    return formatTaskAsYaml(action, params);
  }

  const header = `complete these ${resolvedTasks.length} tasks:`;
  const bulletedTasks = resolvedTasks
    .map(({ action, params }) => `- ${formatTaskAsYaml(action, params, '  ')}`)
    .join('\n\n');
  return `${header}\n\n${bulletedTasks}`;
}

/**
 * Processes tasks through the AI service to generate executable commands.
 * Resolves placeholders in task descriptions and validates the results.
 */
export async function processTasks(
  tasks: Task[],
  service: LLMService
): Promise<TaskProcessingResult> {
  // Load user config for placeholder resolution
  const userConfig = loadUserConfig();

  // Resolve placeholders in task actions
  const resolvedTasks = tasks.map((task) => ({
    action: replacePlaceholders(task.action, userConfig),
    params: task.params,
  }));
  const taskDescriptions = buildTaskDescriptions(resolvedTasks);

  // Call execute tool to get commands
  const result = await service.processWithTool(taskDescriptions, 'execute');

  // Resolve placeholders in command strings
  const resolvedCommands = (result.commands || []).map((cmd) => {
    // Fix escaped quotes lost in JSON parsing
    const fixed = fixEscapedQuotes(cmd.command);
    const resolved = replacePlaceholders(fixed, userConfig);
    validatePlaceholderResolution(resolved);
    return { ...cmd, command: resolved };
  });

  return {
    message: result.message,
    summary: result.summary || '',
    commands: resolvedCommands,
    error: result.error,
    debug: result.debug,
  };
}
