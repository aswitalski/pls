import { Task } from '../types/types.js';
import { ConfigRequirement } from '../types/skills.js';

import {
  extractPlaceholders,
  pathToString,
  resolveVariant,
} from './resolver.js';
import { loadUserConfig, hasConfigPath } from './loader.js';
import {
  loadSkillDefinitions,
  createSkillLookup,
  expandSkillReferences,
} from './skills.js';
import { getConfigType } from './parser.js';

/**
 * Validation error for a skill
 */
export interface ValidationError {
  skill: string;
  issues: string[];
}

/**
 * Result of validating execute tasks
 */
export interface ExecuteValidationResult {
  /** Missing config requirements */
  missingConfig: ConfigRequirement[];
  /** Validation errors for invalid skills */
  validationErrors: ValidationError[];
}

/**
 * Validate config requirements for execute tasks
 * Returns validation result with missing config and validation errors
 */
export function validateExecuteTasks(tasks: Task[]): ExecuteValidationResult {
  const userConfig = loadUserConfig();
  const missing: ConfigRequirement[] = [];
  const seenPaths = new Set<string>();
  const validationErrors: ValidationError[] = [];
  const seenSkills = new Set<string>();

  // Load all skills (including invalid ones for validation)
  const parsedSkills = loadSkillDefinitions();
  const skillLookup = createSkillLookup(parsedSkills);

  // Check for invalid skills being used in tasks
  for (const task of tasks) {
    const skillName =
      typeof task.params?.skill === 'string' ? task.params.skill : null;

    if (skillName && !seenSkills.has(skillName)) {
      seenSkills.add(skillName);

      // Check if this skill is invalid
      const skill = skillLookup(skillName);

      if (skill && !skill.isValid) {
        validationErrors.push({
          skill: skill.name,
          issues: [skill.validationError || 'Unknown validation error'],
        });
      }
    }
  }

  // If there are validation errors, return early
  if (validationErrors.length > 0) {
    return {
      missingConfig: [],
      validationErrors,
    };
  }

  for (const task of tasks) {
    // Check if task originates from a skill
    const skillName =
      typeof task.params?.skill === 'string' ? task.params.skill : null;

    if (skillName) {
      // Task comes from a skill - check skill's Execution section
      const skill = skillLookup(skillName);
      if (!skill) {
        continue;
      }

      // Get variant from task params (if any)
      // Try params.variant first, then look for other param keys that might be the variant
      let variant: string | null = null;

      if (typeof task.params?.variant === 'string') {
        variant = task.params.variant.toLowerCase();
      } else if (task.params && typeof task.params === 'object') {
        // Look for other params that could be the variant (e.g., product, target, option, etc.)
        // Exclude known non-variant params
        const excludeKeys = new Set(['skill', 'type']);
        for (const [key, value] of Object.entries(task.params)) {
          if (!excludeKeys.has(key) && typeof value === 'string') {
            variant = value.toLowerCase();
            break;
          }
        }
      }

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
          });
        }
      }
    }
  }

  return {
    missingConfig: missing,
    validationErrors: [],
  };
}
