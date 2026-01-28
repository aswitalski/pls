import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

import { LearnStepPair } from '../types/components.js';
import { AppError, ErrorCode } from '../types/errors.js';
import { SkillDefinition, SkillsForPrompt } from '../types/skills.js';

import { defaultFileSystem, FileSystem } from './filesystem.js';
import { displayWarning } from './logger.js';
import { getUnknownSkillMessage } from './messages.js';
import { parseSkillMarkdown, displayNameToKey } from './parser.js';

/**
 * Built-in skill names that user skills cannot override
 */
const BUILT_IN_SKILLS = new Set([
  'schedule',
  'execute',
  'answer',
  'configure',
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
 * Check if skill key conflicts with system skills
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
 * Filters out invalid filenames and conflicts with system skills
 */
export function loadSkills(
  fs: FileSystem = defaultFileSystem
): Array<{ key: string; content: string }> {
  const skillsDir = getSkillsDirectory();

  // Return empty array if directory doesn't exist
  if (!fs.exists(skillsDir)) {
    return [];
  }

  try {
    const files = fs.readDirectory(skillsDir);

    // Filter and map valid skill files
    return files
      .filter((file) => {
        // Must follow kebab-case naming convention
        if (!isValidSkillFilename(file)) {
          return false;
        }

        // Extract key (filename without extension, handles both .md and .MD)
        const key = file.slice(0, -3);

        // Must not conflict with system skills
        if (conflictsWithBuiltIn(key)) {
          return false;
        }

        return true;
      })
      .map((file) => {
        // Extract key (filename without extension, handles both .md and .MD)
        const key = file.slice(0, -3);
        const filePath = join(skillsDir, file);
        const content = fs.readFile(filePath, 'utf-8');

        return { key, content };
      });
  } catch (error) {
    displayWarning('Failed to load skills directory', error);
    return [];
  }
}

/**
 * Load and parse all skill definitions
 * Returns structured skill definitions (including invalid skills)
 */
export function loadSkillDefinitions(
  fs: FileSystem = defaultFileSystem
): SkillDefinition[] {
  const skills = loadSkills(fs);
  return skills.map(({ key, content }) => parseSkillMarkdown(key, content));
}

/**
 * Mark incomplete skill in markdown by appending (INCOMPLETE) to name
 */
function markIncompleteSkill(content: string): string {
  return content.replace(
    /^(#{1,6}\s+Name\s*\n+)(.+?)(\n|$)/im,
    `$1$2 (INCOMPLETE)$3`
  );
}

/**
 * Load skills with both formatted prompt section and parsed definitions
 * Single source of truth for both LLM prompts and debug display
 * Parses each skill only once for efficiency
 */
export function loadSkillsForPrompt(
  fs: FileSystem = defaultFileSystem
): SkillsForPrompt {
  const skills = loadSkills(fs);

  // Parse each skill once and build both outputs
  const definitions: SkillDefinition[] = [];
  const markedContent: string[] = [];

  for (const { key, content } of skills) {
    const parsed = parseSkillMarkdown(key, content);
    definitions.push(parsed);

    // Mark incomplete skills in markdown for LLM
    if (parsed.isIncomplete) {
      markedContent.push(markIncompleteSkill(content));
    } else {
      markedContent.push(content);
    }
  }

  const formatted = formatSkillsForPrompt(markedContent);

  return { formatted, definitions };
}

/**
 * Load skills and mark incomplete ones in their markdown
 * Returns array of skill markdown with status markers
 * Uses loadSkillsForPrompt internally to avoid duplicating logic
 */
export function loadSkillsWithValidation(
  fs: FileSystem = defaultFileSystem
): string[] {
  const skills = loadSkills(fs);

  return skills.map(({ key, content }) => {
    const parsed = parseSkillMarkdown(key, content);

    if (parsed.isIncomplete) {
      return markIncompleteSkill(content);
    }

    return content;
  });
}

/**
 * Create skill lookup function from definitions
 * Lookup by key (display name is converted to kebab-case for matching)
 * Example: "Deploy App" -> "deploy-app" -> matches skill with key "deploy-app"
 */
export function createSkillLookup(
  definitions: SkillDefinition[]
): (name: string) => SkillDefinition | null {
  const keyMap = new Map<string, SkillDefinition>();

  for (const definition of definitions) {
    keyMap.set(definition.key, definition);
  }

  return (name: string) => {
    // Convert display name to kebab-case key for lookup
    const key = displayNameToKey(name);
    return keyMap.get(key) || null;
  };
}

/**
 * Format skills for inclusion in the planning prompt
 * Skills are joined with double newlines (skill headers provide separation)
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

  const skillsContent = skills.map((s) => s.trim()).join('\n\n');

  return header + skillsContent;
}

/**
 * Parse skill reference from execution line
 * Format: [ Display Name ] with mandatory spaces
 * Returns display name if line matches format, otherwise null
 * Example: "[ My Skill ]" -> "My Skill"
 */
export function parseSkillReference(line: string): string | null {
  // Must match format: [ content ] with at least one space before and after
  const match = line.trim().match(/^\[\s+(.+?)\s+\]$/);
  return match ? match[1] : null;
}

/**
 * Check if execution line is a skill reference
 * Must have format: [ content ] with spaces
 */
export function isSkillReference(line: string): boolean {
  return /^\[\s+.+?\s+\]$/.test(line.trim());
}

/**
 * Expand skill references in execution commands
 * Returns expanded execution lines with references replaced
 * Throws error if circular reference detected or skill not found
 * Reference format: [ Skill Name ]
 */
export function expandSkillReferences(
  execution: string[],
  skillLookup: (name: string) => SkillDefinition | null,
  visited: Set<string> = new Set()
): string[] {
  const expanded: string[] = [];

  for (const line of execution) {
    // First: Detect if line matches [ XXX ] format
    const skillName = parseSkillReference(line);

    if (!skillName) {
      // Not a reference, keep command as-is
      expanded.push(line);
      continue;
    }

    // Check for circular reference
    if (visited.has(skillName)) {
      throw new AppError(
        `Circular skill reference detected: ${Array.from(visited).join(' → ')} → ${skillName}`,
        ErrorCode.CircularReference
      );
    }

    // Second: Match against skill name
    const skill = skillLookup(skillName);

    if (!skill) {
      // Referenced skill not found - throw error to break execution
      throw new Error(getUnknownSkillMessage(skillName));
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

/**
 * Check if a skill name is available (not conflicting with existing files
 * or built-in skills)
 */
export function isSkillNameAvailable(
  name: string,
  fs: FileSystem = defaultFileSystem
): { available: boolean; reason?: string } {
  const key = displayNameToKey(name);

  if (!key) {
    return { available: false, reason: 'Skill name is required' };
  }

  if (conflictsWithBuiltIn(key)) {
    return { available: false, reason: 'Name conflicts with a built-in skill' };
  }

  const skillsDir = getSkillsDirectory();
  const filePath = join(skillsDir, `${key}.md`);

  if (fs.exists(filePath)) {
    return {
      available: false,
      reason: 'A skill with this name already exists',
    };
  }

  return { available: true };
}

/**
 * Convert dot-notation config entries to nested YAML format.
 * Input: ["pdf.base.dir: string", "pdf.base.format: string"]
 * Output: "pdf:\n  base:\n    dir: string\n    format: string\n"
 */
export function configEntriesToYaml(entries: string[]): string {
  const root: Record<string, unknown> = {};

  for (const entry of entries) {
    const colonIndex = entry.lastIndexOf(':');
    if (colonIndex === -1) continue;

    const path = entry.slice(0, colonIndex).trim();
    const type = entry.slice(colonIndex + 1).trim();
    const parts = path.split('.');

    let current: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = type;
  }

  return YAML.stringify(root, { indent: 2 });
}

/**
 * Generate skill markdown from collected data
 */
export function generateSkillMarkdown(
  name: string,
  description: string,
  aliases: string[],
  configEntries: string[],
  stepPairs: LearnStepPair[]
): string {
  let markdown = `### Name\n${name}\n\n`;
  markdown += `### Description\n${description}\n\n`;

  if (aliases.length > 0) {
    markdown += `### Aliases\n`;
    for (const alias of aliases) {
      markdown += `- ${alias}\n`;
    }
    markdown += '\n';
  }

  if (configEntries.length > 0) {
    markdown += `### Config\n`;
    markdown += configEntriesToYaml(configEntries);
    markdown += '\n';
  }

  markdown += `### Steps\n`;
  for (const pair of stepPairs) {
    markdown += `- ${pair.description}\n`;
  }
  markdown += '\n';

  markdown += `### Execution\n`;
  for (const pair of stepPairs) {
    if (pair.executionType === 'reference') {
      markdown += `- [ ${pair.execution} ]\n`;
    } else {
      markdown += `- ${pair.execution}\n`;
    }
  }

  return markdown;
}

/**
 * Save skill to file (creates directory if needed)
 */
export function saveSkill(
  key: string,
  content: string,
  fs: FileSystem = defaultFileSystem
): void {
  const skillsDir = getSkillsDirectory();

  // Create directory if it doesn't exist
  if (!fs.exists(skillsDir)) {
    fs.createDirectory(skillsDir, { recursive: true });
  }

  const filePath = join(skillsDir, `${key}.md`);
  fs.writeFile(filePath, content);
}

/**
 * Get list of available skill names for reference selection
 */
export function getAvailableSkillNames(
  fs: FileSystem = defaultFileSystem
): string[] {
  const definitions = loadSkillDefinitions(fs);
  return definitions.filter((def) => def.isValid).map((def) => def.name);
}
