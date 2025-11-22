import { Task } from '../types/types.js';
import { ConfigRequirement } from '../types/skills.js';

import {
  extractPlaceholders,
  pathToString,
  resolveVariant,
} from './placeholder-resolver.js';
import { loadUserConfig, hasConfigPath } from './config-loader.js';
import { loadSkills } from './skills.js';
import { expandSkillReferences } from './skill-expander.js';
import { getConfigType, parseSkillMarkdown } from './skill-parser.js';

/**
 * Validate config requirements for execute tasks
 * Returns missing config requirements
 */
export function validateExecuteTasks(tasks: Task[]): ConfigRequirement[] {
  const userConfig = loadUserConfig();
  const missing: ConfigRequirement[] = [];
  const seenPaths = new Set<string>();

  // Load and parse all skills for validation
  const skillContents = loadSkills();
  const parsedSkills = skillContents
    .map((content) => parseSkillMarkdown(content))
    .filter((s) => s !== null);
  const skillLookup = (name: string) =>
    parsedSkills.find((s) => s.name === name) || null;

  for (const task of tasks) {
    // Check if task originates from a skill
    const skillName =
      typeof task.params?.skill === 'string' ? task.params.skill : null;

    if (skillName) {
      // Task comes from a skill - check skill's Execution section
      const skill = skillLookup(skillName);
      if (!skill || !skill.execution) {
        continue;
      }

      // Get variant from task params (if any)
      const variant =
        typeof task.params?.variant === 'string'
          ? task.params.variant.toLowerCase()
          : null;

      // Expand skill references to get actual commands
      const expanded = expandSkillReferences(skill.execution, skillLookup);

      // Extract placeholders from actual commands
      for (const line of expanded) {
        const placeholders = extractPlaceholders(line);

        for (const placeholder of placeholders) {
          let resolvedPath: string;

          if (placeholder.hasVariant) {
            // Variant placeholder - resolve with variant from params
            if (!variant) {
              // No variant provided - skip this placeholder
              continue;
            }

            const resolvedPathArray = resolveVariant(placeholder.path, variant);
            resolvedPath = pathToString(resolvedPathArray);
          } else {
            // Strict placeholder - use as-is
            resolvedPath = pathToString(placeholder.path);
          }

          // Skip if already processed
          if (seenPaths.has(resolvedPath)) {
            continue;
          }

          seenPaths.add(resolvedPath);

          // Check if config exists
          if (!hasConfigPath(userConfig, resolvedPath)) {
            // Get type from skill config
            const type = skill.config
              ? getConfigType(skill.config, resolvedPath)
              : undefined;

            missing.push({
              path: resolvedPath,
              type: type || 'string',
              description: generateDescription(resolvedPath),
            });
          }
        }
      }
    } else {
      // Task doesn't come from a skill - check task action for placeholders
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
  }

  return missing;
}

/**
 * Generate human-readable description for config path
 * Note: This is a fallback. The VALIDATE tool should generate proper descriptions
 * based on skill context when creating CONFIG tasks.
 */
function generateDescription(path: string): string {
  const parts = path.split('.');

  // Simple capitalization as fallback
  const description = parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return `${description} {${path}}`;
}
