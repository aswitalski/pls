import { existsSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { SkillDefinition } from '../types/skills.js';

import { parseSkillMarkdown } from './skill-parser.js';

/**
 * Built-in skill names that user skills cannot override
 */
const BUILT_IN_SKILLS = new Set([
  'plan',
  'execute',
  'answer',
  'config',
  'validate',
  'introspect',
]);

/**
 * Validate filename follows kebab-case pattern
 * Valid: deploy-app.md, build-project-2.md, copy-files.md
 * Invalid: Deploy_App.md, buildProject.md, DEPLOY.md, file name.md
 */
export function isValidSkillFilename(filename: string): boolean {
  // Must end with .md or .MD extension
  if (!filename.endsWith('.md') && !filename.endsWith('.MD')) {
    return false;
  }

  // Extract name without extension
  const name = filename.slice(0, -3);

  // Must match kebab-case pattern: lowercase letters, numbers, and hyphens only
  // Must start with a letter, and not start or end with a hyphen
  const kebabCasePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

  return kebabCasePattern.test(name);
}

/**
 * Check if skill key conflicts with built-in skills
 */
export function conflictsWithBuiltIn(key: string): boolean {
  return BUILT_IN_SKILLS.has(key);
}

/**
 * Get the path to the skills directory
 */
export function getSkillsDirectory(): string {
  return join(homedir(), '.pls', 'skills');
}

/**
 * Load all skill markdown files from the skills directory
 * Returns an array of objects with filename (key) and content
 * Filters out invalid filenames and conflicts with built-in skills
 */
export function loadSkills(): Array<{ key: string; content: string }> {
  const skillsDir = getSkillsDirectory();

  // Return empty array if directory doesn't exist
  if (!existsSync(skillsDir)) {
    return [];
  }

  try {
    const files = readdirSync(skillsDir);

    // Filter and map valid skill files
    return files
      .filter((file) => {
        // Must follow kebab-case naming convention
        if (!isValidSkillFilename(file)) {
          return false;
        }

        // Extract key (filename without extension, handles both .md and .MD)
        const key = file.slice(0, -3);

        // Must not conflict with built-in skills
        if (conflictsWithBuiltIn(key)) {
          return false;
        }

        return true;
      })
      .map((file) => {
        // Extract key (filename without extension, handles both .md and .MD)
        const key = file.slice(0, -3);
        const filePath = join(skillsDir, file);
        const content = readFileSync(filePath, 'utf-8');

        return { key, content };
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
  const skills = loadSkills();
  return skills.map(({ key, content }) => parseSkillMarkdown(key, content));
}

/**
 * Load skills and mark incomplete ones in their markdown
 * Returns array of skill markdown with status markers
 */
export function loadSkillsWithValidation(): string[] {
  const skills = loadSkills();

  return skills.map(({ key, content }) => {
    const parsed = parseSkillMarkdown(key, content);

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
 * Lookup by display name only (from Name section or derived from key)
 */
export function createSkillLookup(
  definitions: SkillDefinition[]
): (name: string) => SkillDefinition | null {
  const nameMap = new Map<string, SkillDefinition>();

  for (const definition of definitions) {
    nameMap.set(definition.name, definition);
  }

  return (name: string) => nameMap.get(name) || null;
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
