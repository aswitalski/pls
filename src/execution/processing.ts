import { Task } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';
import { loadUserConfig } from '../services/loader.js';
import { replacePlaceholders } from '../services/resolver.js';

import { TaskProcessingResult } from './types.js';
import { validatePlaceholderResolution } from './validation.js';

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

  // Format tasks for the execute tool and resolve placeholders
  const taskDescriptions = tasks
    .map((task) => {
      const resolvedAction = replacePlaceholders(task.action, userConfig);
      const params = task.params
        ? ` (params: ${JSON.stringify(task.params)})`
        : '';
      return `- ${resolvedAction}${params}`;
    })
    .join('\n');

  // Call execute tool to get commands
  const result = await service.processWithTool(taskDescriptions, 'execute');

  // Resolve placeholders in command strings
  const resolvedCommands = (result.commands || []).map((cmd) => {
    const resolved = replacePlaceholders(cmd.command, userConfig);
    validatePlaceholderResolution(resolved);
    return { ...cmd, command: resolved };
  });

  return {
    message: result.message,
    summary: result.summary || '',
    commands: resolvedCommands,
    debug: result.debug,
  };
}
