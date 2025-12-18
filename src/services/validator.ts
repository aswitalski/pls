import { Task } from '../types/types.js';
import { ConfigRequirement } from '../types/skills.js';

import { loadUserConfig, hasConfigPath } from './loader.js';
import { loadSkillDefinitions, createSkillLookup } from './skills.js';

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
    // Check task's config array from SCHEDULE tool
    // This is the authoritative source for required configuration
    if (task.config && task.config.length > 0) {
      for (const configPath of task.config) {
        if (typeof configPath !== 'string') {
          continue;
        }

        // Skip if already processed
        if (seenPaths.has(configPath)) {
          continue;
        }

        seenPaths.add(configPath);

        // Check if config exists
        if (!hasConfigPath(userConfig, configPath)) {
          missing.push({
            path: configPath,
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
