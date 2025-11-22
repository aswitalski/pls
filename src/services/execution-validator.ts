import { Task } from '../types/types.js';
import { ConfigRequirement } from '../types/skills.js';

import { extractPlaceholders } from './placeholder-resolver.js';
import { loadUserConfig, hasConfigPath } from './config-loader.js';

/**
 * Validate config requirements for execute tasks
 * Returns missing config requirements
 */
export function validateExecuteTasks(tasks: Task[]): ConfigRequirement[] {
  const userConfig = loadUserConfig();
  const missing: ConfigRequirement[] = [];
  const seenPaths = new Set<string>();

  for (const task of tasks) {
    // Extract placeholders from task action
    const placeholders = extractPlaceholders(task.action);

    for (const placeholder of placeholders) {
      // Skip variant placeholders - they should have been resolved during planning
      if (placeholder.hasVariant) {
        continue;
      }

      const path = placeholder.path.join('.');

      // Skip if already processed
      if (seenPaths.has(path)) {
        continue;
      }

      seenPaths.add(path);

      // Check if config exists
      if (!hasConfigPath(userConfig, path)) {
        missing.push({
          path,
          type: 'string', // Default to string for now
          description: generateDescription(path),
        });
      }
    }
  }

  return missing;
}

/**
 * Generate human-readable description for config path
 */
function generateDescription(path: string): string {
  const parts = path.split('.');

  // Capitalize first letter of each part
  const formatted = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formatted;
}
