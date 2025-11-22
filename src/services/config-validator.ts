import {
  ConfigRequirement,
  ConfigValidationResult,
  SkillDefinition,
} from '../types/skills.js';

import {
  extractPlaceholders,
  pathToString,
  resolveVariant,
} from './placeholder-resolver.js';
import { getConfigType } from './skill-parser.js';
import { expandSkillReferences } from './skill-expander.js';
import { loadUserConfig, hasConfigPath } from './config-loader.js';

/**
 * Validate config requirements for skill execution
 * Returns validation result with missing config paths
 */
export function validateSkillConfig(
  skill: SkillDefinition,
  variantMap: Record<string, string>,
  skillLookup: (name: string) => SkillDefinition | null
): ConfigValidationResult {
  if (!skill.execution || skill.execution.length === 0) {
    return { valid: true, missing: [] };
  }

  // Expand skill references to get full execution commands
  const expanded = expandSkillReferences(skill.execution, skillLookup);

  // Collect all referenced skills (including current skill)
  const allSkills = getAllReferencedSkills(skill, skillLookup);

  // Extract all config paths from expanded execution
  const requiredPaths = new Set<string>();

  for (const line of expanded) {
    const placeholders = extractPlaceholders(line);

    for (const placeholder of placeholders) {
      if (placeholder.hasVariant) {
        // Resolve variant using variant map
        const variantKey = pathToString(
          placeholder.path.slice(0, placeholder.variantIndex)
        );
        const variantName = variantMap[variantKey];

        if (!variantName) {
          // Variant not specified - cannot determine config path
          continue;
        }

        // Replace VARIANT with actual variant name
        const resolvedPath = resolveVariant(placeholder.path, variantName);
        requiredPaths.add(pathToString(resolvedPath));
      } else {
        // Strict placeholder - use path as-is
        requiredPaths.add(pathToString(placeholder.path));
      }
    }
  }

  // Load user config
  const userConfig = loadUserConfig();

  // Check which paths are missing
  const missing: ConfigRequirement[] = [];

  for (const path of requiredPaths) {
    if (!hasConfigPath(userConfig, path)) {
      // Determine type from skill configs
      const type = getConfigTypeFromSkills(path, allSkills);

      missing.push({
        path,
        type: type || 'string',
        description: generateDescription(path),
      });
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get all skills referenced by a skill (including the skill itself)
 */
function getAllReferencedSkills(
  skill: SkillDefinition,
  skillLookup: (name: string) => SkillDefinition | null
): SkillDefinition[] {
  const skills: SkillDefinition[] = [skill];
  const visited = new Set<string>([skill.name]);

  if (!skill.execution) {
    return skills;
  }

  for (const line of skill.execution) {
    const match = line.match(/^\[(.+)\]$/);
    if (!match) {
      continue;
    }

    const referencedName = match[1].trim();
    if (visited.has(referencedName)) {
      continue;
    }

    const referenced = skillLookup(referencedName);
    if (referenced) {
      visited.add(referencedName);
      skills.push(...getAllReferencedSkills(referenced, skillLookup));
    }
  }

  return skills;
}

/**
 * Get config type from skill configs
 */
function getConfigTypeFromSkills(
  path: string,
  skills: SkillDefinition[]
): 'string' | 'boolean' | 'number' | undefined {
  for (const skill of skills) {
    if (!skill.config) {
      continue;
    }

    const type = getConfigType(skill.config, path);
    if (type) {
      return type;
    }
  }

  return undefined;
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
