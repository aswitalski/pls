import { existsSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { SkillDefinition } from '../types/skills.js';

import { parseSkillMarkdown } from './skill-parser.js';

/**
 * Get the path to the skills directory
 */
export function getSkillsDirectory(): string {
  return join(homedir(), '.pls', 'skills');
}

/**
 * Load all skill markdown files from the skills directory
 * Returns an array of skill file contents
 */
export function loadSkills(): string[] {
  const skillsDir = getSkillsDirectory();

  // Return empty array if directory doesn't exist
  if (!existsSync(skillsDir)) {
    return [];
  }

  try {
    const files = readdirSync(skillsDir);

    // Filter for markdown files
    const skillFiles = files.filter(
      (file) => file.endsWith('.md') || file.endsWith('.MD')
    );

    // Read and return contents of each skill file
    return skillFiles.map((file) => {
      const filePath = join(skillsDir, file);
      return readFileSync(filePath, 'utf-8');
    });
  } catch {
    // Return empty array if there's any error reading the directory
    return [];
  }
}

/**
 * Load and parse all skill definitions
 * Returns structured skill definitions (including invalid skills)
 */
export function loadSkillDefinitions(): SkillDefinition[] {
  const skillContents = loadSkills();
  return skillContents.map((content) => parseSkillMarkdown(content));
}

/**
 * Load skills and mark incomplete ones in their markdown
 * Returns array of skill markdown with status markers
 */
export function loadSkillsWithValidation(): string[] {
  const skillContents = loadSkills();

  return skillContents.map((content) => {
    const parsed = parseSkillMarkdown(content);

    // If skill is incomplete (either validation failed or needs more documentation), append (INCOMPLETE) to the name
    if (parsed.isIncomplete) {
      return content.replace(
        /^(#{1,6}\s+Name\s*\n+)(.+?)(\n|$)/im,
        `$1$2 (INCOMPLETE)$3`
      );
    }

    return content;
  });
}

/**
 * Create skill lookup function from definitions
 */
export function createSkillLookup(
  definitions: SkillDefinition[]
): (name: string) => SkillDefinition | null {
  const map = new Map<string, SkillDefinition>();

  for (const definition of definitions) {
    map.set(definition.name, definition);
  }

  return (name: string) => map.get(name) || null;
}

/**
 * Format skills for inclusion in the planning prompt
 */
export function formatSkillsForPrompt(skills: string[]): string {
  if (skills.length === 0) {
    return '';
  }

  const header = `

## Available Skills

The following skills define domain-specific workflows. When the user's
query matches a skill, incorporate the skill's steps into your plan.

Skills marked with (INCOMPLETE) have validation errors or need more
documentation, and cannot be executed. These should be listed in
introspection with their markers.

**IMPORTANT**: When creating options from skill descriptions, do NOT use
brackets for additional information. Use commas instead. For example:
- CORRECT: "Build project Alpha, the legacy version"
- WRONG: "Build project Alpha (the legacy version)"

`;

  const skillsContent = skills.join('\n\n');

  return header + skillsContent;
}
