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
import { loadDebugSetting } from './configuration.js';

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
  const debug = loadDebugSetting();

  if (debug) {
    console.log('\n=== CONFIG VALIDATION ===');
    console.log(`→ Validating ${tasks.length} task(s)`);
  }

  const userConfig = loadUserConfig();
  const missing: ConfigRequirement[] = [];
  const seenPaths = new Set<string>();
  const validationErrors: ValidationError[] = [];
  const seenSkills = new Set<string>();

  // Load all skills (including invalid ones for validation)
  const skillContents = loadSkills();
  const parsedSkills = skillContents.map((content) =>
    parseSkillMarkdown(content)
  );
  const skillLookup = (name: string) =>
    parsedSkills.find((s) => s.name === name) || null;

  if (debug) {
    console.log(`→ Loaded ${parsedSkills.length} skill(s) for validation`);
  }

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
    if (debug) {
      console.log(`\n→ Checking task: ${task.action}`);
    }

    // Check if task originates from a skill
    const skillName =
      typeof task.params?.skill === 'string' ? task.params.skill : null;

    if (skillName) {
      if (debug) {
        console.log(`  → Task uses skill: "${skillName}"`);
      }

      // Task comes from a skill - check skill's Execution section
      const skill = skillLookup(skillName);
      if (!skill) {
        if (debug) {
          console.log(`  → Skill "${skillName}" not found`);
        }
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

      if (debug) {
        if (variant) {
          console.log(`  → Extracted variant from params: "${variant}"`);
        } else {
          console.log(`  → No variant found in params`);
        }
      }

      // Expand skill references to get actual commands
      const expanded = expandSkillReferences(skill.execution, skillLookup);

      if (debug) {
        console.log(
          `  → Skill execution expanded to ${expanded.length} command(s):`
        );
        expanded.forEach((line, idx) => {
          console.log(`     ${idx + 1}. ${line}`);
        });
      }

      // Extract placeholders from actual commands
      for (const line of expanded) {
        const placeholders = extractPlaceholders(line);

        if (debug && placeholders.length > 0) {
          console.log(
            `  → Found ${placeholders.length} placeholder(s) in: ${line}`
          );
        }

        for (const placeholder of placeholders) {
          if (debug) {
            console.log(
              `     • Placeholder: ${placeholder.original} (path: ${placeholder.path.join('.')})`
            );
          }

          let resolvedPath: string;

          if (placeholder.hasVariant) {
            if (debug) {
              console.log(
                `       → Has variant at index ${placeholder.variantIndex}`
              );
            }

            // Variant placeholder - resolve with variant from params
            if (!variant) {
              if (debug) {
                console.log(
                  `       → No variant provided - skipping this placeholder`
                );
              }
              // No variant provided - skip this placeholder
              continue;
            }

            const resolvedPathArray = resolveVariant(placeholder.path, variant);
            resolvedPath = pathToString(resolvedPathArray);

            if (debug) {
              console.log(
                `       → Resolved variant placeholder: ${placeholder.original} → {${resolvedPath}}`
              );
            }
          } else {
            // Strict placeholder - use as-is
            resolvedPath = pathToString(placeholder.path);

            if (debug) {
              console.log(`       → Strict placeholder: {${resolvedPath}}`);
            }
          }

          // Skip if already processed
          if (seenPaths.has(resolvedPath)) {
            if (debug) {
              console.log(`       → Already checked - skipping`);
            }
            continue;
          }

          seenPaths.add(resolvedPath);

          // Check if config exists
          if (!hasConfigPath(userConfig, resolvedPath)) {
            if (debug) {
              console.log(
                `       → ❌ Config path "${resolvedPath}" NOT FOUND in ~/.plsrc`
              );
            }

            // Get type from skill config
            const type = skill.config
              ? getConfigType(skill.config, resolvedPath)
              : undefined;

            missing.push({
              path: resolvedPath,
              type: type || 'string',
            });
          } else {
            if (debug) {
              console.log(
                `       → ✓ Config path "${resolvedPath}" exists in ~/.plsrc`
              );
            }
          }
        }
      }
    } else {
      if (debug) {
        console.log(`  → Task does not use a skill`);
      }

      // Task doesn't come from a skill - check task action for placeholders
      const placeholders = extractPlaceholders(task.action);

      if (debug && placeholders.length > 0) {
        console.log(
          `  → Found ${placeholders.length} placeholder(s) in task action`
        );
      }

      for (const placeholder of placeholders) {
        // Skip variant placeholders - they should have been resolved during planning
        if (placeholder.hasVariant) {
          if (debug) {
            console.log(
              `     • Skipping variant placeholder ${placeholder.original} (should be resolved in PLAN)`
            );
          }
          continue;
        }

        const path = placeholder.path.join('.');

        if (debug) {
          console.log(`     • Checking placeholder: {${path}}`);
        }

        // Skip if already processed
        if (seenPaths.has(path)) {
          if (debug) {
            console.log(`       → Already checked - skipping`);
          }
          continue;
        }

        seenPaths.add(path);

        // Check if config exists
        if (!hasConfigPath(userConfig, path)) {
          if (debug) {
            console.log(`       → ❌ Config path "${path}" NOT FOUND`);
          }

          missing.push({
            path,
            type: 'string', // Default to string for now
          });
        } else {
          if (debug) {
            console.log(`       → ✓ Config path "${path}" exists`);
          }
        }
      }
    }
  }

  if (debug) {
    console.log(`\n→ Validation complete`);
    if (missing.length > 0) {
      console.log(`→ ❌ Missing ${missing.length} config path(s):`);
      missing.forEach((req) => {
        console.log(`   - ${req.path} (type: ${req.type})`);
      });
    } else {
      console.log(`→ ✓ All required config paths exist`);
    }
    console.log('========================\n');
  }

  return {
    missingConfig: missing,
    validationErrors: [],
  };
}
