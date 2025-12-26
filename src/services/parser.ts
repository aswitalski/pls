import YAML from 'yaml';

import { ConfigSchema, SkillDefinition } from '../types/skills.js';

import { displayWarning } from './logger.js';

export interface SkillValidationError {
  skillName: string;
  error: string;
}

/**
 * Validate a skill without parsing it fully
 * Returns validation error if skill is invalid, null if valid
 * Note: Name section is optional - key from filename is used as fallback
 */
export function validateSkillStructure(
  content: string,
  key: string
): SkillValidationError | null {
  const sections = extractSections(content);

  // Use key for error reporting if name not present
  const skillName = sections.name || key;

  // Check required sections (Name is now optional)
  if (!sections.description) {
    return {
      skillName,
      error: 'The skill file is missing a Description section',
    };
  }

  if (!sections.steps || sections.steps.length === 0) {
    return {
      skillName,
      error: 'The skill file is missing a Steps section',
    };
  }

  if (!sections.execution || sections.execution.length === 0) {
    return {
      skillName,
      error: 'The skill file is missing an Execution section',
    };
  }

  // Execution and steps must have same count
  if (sections.execution.length !== sections.steps.length) {
    return {
      skillName,
      error: `The skill has ${String(sections.steps.length)} steps but ${String(sections.execution.length)} execution lines`,
    };
  }

  return null;
}

/**
 * Convert kebab-case key to Title Case display name
 * Examples: "deploy-app" -> "Deploy App", "build-project-2" -> "Build Project 2"
 */
function keyToDisplayName(key: string): string {
  return key
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convert display name to kebab-case key
 * Examples: "Deploy App" -> "deploy-app", "Navigate To Product" -> "navigate-to-product"
 */
export function displayNameToKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Parse a skill markdown file into structured definition
 */
export function parseSkillMarkdown(
  key: string,
  content: string
): SkillDefinition {
  const sections = extractSections(content);

  // Determine display name: prefer Name section, otherwise derive from key
  const displayName = sections.name || keyToDisplayName(key);

  // Validate the skill (Name is no longer required since we have key)
  const validationError = validateSkillStructure(content, key);

  // For invalid skills, return minimal definition with error
  if (validationError) {
    return {
      key,
      name: displayName,
      description: sections.description || '',
      steps: sections.steps || [],
      execution: sections.execution || [],
      isValid: false,
      validationError: validationError.error,
      isIncomplete: true,
    };
  }

  // Valid skill - all required fields are present (validation passed)
  const description = sections.description as string;
  const skill: SkillDefinition = {
    key,
    name: displayName,
    description,
    steps: sections.steps as string[],
    execution: sections.execution as string[],
    isValid: true,
  };

  // Check if skill is incomplete (valid but needs more documentation)
  const MIN_DESCRIPTION_LENGTH = 20;
  if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
    skill.isIncomplete = true;
  }

  if (sections.aliases && sections.aliases.length > 0) {
    skill.aliases = sections.aliases;
  }

  if (sections.config) {
    skill.config = sections.config;
  }

  return skill;
}

/**
 * Extract sections from markdown content
 */
function extractSections(content: string): {
  name?: string;
  description?: string;
  aliases?: string[];
  config?: ConfigSchema;
  steps?: string[];
  execution?: string[];
} {
  const lines = content.split('\n');
  const sections: ReturnType<typeof extractSections> = {};

  let currentSection: string | null = null;
  let sectionLines: string[] = [];

  for (const line of lines) {
    // Check for section headers (any valid markdown header: #, ##, ###, etc.)
    const headerMatch = line.match(/^#{1,6}\s+(.+)$/);

    if (headerMatch) {
      // Process previous section
      if (currentSection) {
        processSectionContent(currentSection, sectionLines, sections);
      }

      // Start new section
      currentSection = headerMatch[1].trim().toLowerCase();
      sectionLines = [];
    } else if (currentSection) {
      // Accumulate lines for current section
      sectionLines.push(line);
    }
  }

  // Process final section
  if (currentSection) {
    processSectionContent(currentSection, sectionLines, sections);
  }

  return sections;
}

/**
 * Process accumulated section content
 */
function processSectionContent(
  sectionName: string,
  lines: string[],
  sections: ReturnType<typeof extractSections>
): void {
  const content = lines.join('\n').trim();

  if (!content) {
    return;
  }

  switch (sectionName) {
    case 'name':
      sections.name = content;
      break;

    case 'description':
      sections.description = content;
      break;

    case 'aliases':
      sections.aliases = extractBulletList(content);
      break;

    case 'config':
      sections.config = parseConfigSchema(content);
      break;

    case 'steps':
      sections.steps = extractBulletList(content);
      break;

    case 'execution':
      sections.execution = extractBulletList(content);
      break;
  }
}

/**
 * Extract bullet list items from content
 */
function extractBulletList(content: string): string[] {
  const lines = content.split('\n');
  const items: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Match bullet points: "- text" or "* text"
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

    if (bulletMatch) {
      items.push(bulletMatch[1].trim());
    }
  }

  return items;
}

/**
 * Parse YAML config schema
 */
function parseConfigSchema(content: string): ConfigSchema | undefined {
  try {
    const parsed: unknown = YAML.parse(content);

    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }

    return parsed as ConfigSchema;
  } catch (error) {
    displayWarning('Failed to parse config schema in skill', error);
    return undefined;
  }
}

/**
 * Generate all config paths from schema
 */
export function generateConfigPaths(
  schema: ConfigSchema,
  prefix = ''
): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(schema)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      // Leaf node with type annotation
      paths.push(fullKey);
    } else if (typeof value === 'object') {
      // Nested object - recurse
      paths.push(...generateConfigPaths(value, fullKey));
    }
  }

  return paths;
}

/**
 * Get config type for a specific path
 */
export function getConfigType(
  schema: ConfigSchema,
  path: string
): 'string' | 'boolean' | 'number' | undefined {
  const parts = path.split('.');
  let current: ConfigSchema | string | undefined = schema;

  for (const part of parts) {
    if (typeof current === 'string') {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part] as
      | ConfigSchema
      | string;
  }

  if (
    typeof current === 'string' &&
    (current === 'string' || current === 'boolean' || current === 'number')
  ) {
    return current;
  }

  return undefined;
}
