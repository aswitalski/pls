import { SkillDefinition } from '../types/skills.js';

/**
 * Parse skill reference from execution line
 * Returns skill name if line is a reference, otherwise null
 */
export function parseSkillReference(line: string): string | null {
  const match = line.match(/^\[(.+)\]$/);
  return match ? match[1].trim() : null;
}

/**
 * Check if execution line is a skill reference
 */
export function isSkillReference(line: string): boolean {
  return /^\[.+\]$/.test(line.trim());
}

/**
 * Expand skill references in execution commands
 * Returns expanded execution lines with references replaced
 * Throws error if circular reference detected
 */
export function expandSkillReferences(
  execution: string[],
  skillLookup: (name: string) => SkillDefinition | null,
  visited: Set<string> = new Set()
): string[] {
  const expanded: string[] = [];

  for (const line of execution) {
    const skillName = parseSkillReference(line);

    if (!skillName) {
      // Not a reference, keep as-is
      expanded.push(line);
      continue;
    }

    // Check for circular reference
    if (visited.has(skillName)) {
      throw new Error(
        `Circular skill reference detected: ${Array.from(visited).join(' → ')} → ${skillName}`
      );
    }

    // Look up referenced skill
    const skill = skillLookup(skillName);

    if (!skill) {
      // Referenced skill not found, keep as-is
      expanded.push(line);
      continue;
    }

    // Recursively expand referenced skill's execution
    const newVisited = new Set(visited);
    newVisited.add(skillName);

    const referencedExecution = expandSkillReferences(
      skill.execution,
      skillLookup,
      newVisited
    );

    expanded.push(...referencedExecution);
  }

  return expanded;
}

/**
 * Get all skill names referenced in execution (including nested)
 * Returns unique set of skill names
 */
export function getReferencedSkills(
  execution: string[],
  skillLookup: (name: string) => SkillDefinition | null,
  visited: Set<string> = new Set()
): Set<string> {
  const referenced = new Set<string>();

  for (const line of execution) {
    const skillName = parseSkillReference(line);

    if (!skillName || visited.has(skillName)) {
      continue;
    }

    referenced.add(skillName);

    const skill = skillLookup(skillName);

    if (skill) {
      const newVisited = new Set(visited);
      newVisited.add(skillName);

      const nested = getReferencedSkills(
        skill.execution,
        skillLookup,
        newVisited
      );

      for (const name of nested) {
        referenced.add(name);
      }
    }
  }

  return referenced;
}

/**
 * Validate skill references don't form cycles
 * Returns true if valid, false if circular reference detected
 */
export function validateNoCycles(
  execution: string[],
  skillLookup: (name: string) => SkillDefinition | null,
  visited: Set<string> = new Set()
): boolean {
  try {
    expandSkillReferences(execution, skillLookup, visited);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circular')) {
      return false;
    }
    throw error;
  }
}
