import { DebugLevel } from '../configuration/types.js';
import { ComponentDefinition } from '../types/components.js';
import { SkillDefinition } from '../types/skills.js';

import { loadDebugSetting } from '../configuration/io.js';
import { Palette } from './colors.js';
import { createDebug } from './components.js';

/**
 * Enum controlling what content is shown in debug prompt output
 * - LLM: Exact prompt as sent to LLM (no display formatting)
 * - Skills: Same content with visual separators for readability
 * - Summary: Condensed view (Name, Steps, Execution only)
 */
export enum PromptDisplay {
  LLM = 'llm',
  Skills = 'skills',
  Summary = 'summary',
}

/**
 * Debug logger for the application
 * Logs information based on the current debug level setting
 */

let currentDebugLevel: DebugLevel = DebugLevel.None;

/**
 * Accumulated warnings to be displayed in the timeline
 */
const warnings: string[] = [];

/**
 * Initialize the logger with the current debug level from config
 */
export function initializeLogger(): void {
  currentDebugLevel = loadDebugSetting();
}

/**
 * Set the debug level (used for testing or runtime changes)
 */
export function setDebugLevel(debug: DebugLevel): void {
  currentDebugLevel = debug;
}

/**
 * Get the current debug level
 */
export function getDebugLevel(): DebugLevel {
  return currentDebugLevel;
}

/**
 * Store a warning message to be displayed in the timeline
 * Only stores warnings at Info or Verbose debug levels
 */
export function displayWarning(message: string, error?: unknown): void {
  if (currentDebugLevel === DebugLevel.None) {
    return;
  }

  const errorDetails = error instanceof Error ? `: ${error.message}` : '';
  warnings.push(`${message}${errorDetails}`);
}

/**
 * Get all accumulated warnings and clear the list
 * Returns array of warning messages
 */
export function getWarnings(): string[] {
  const result = [...warnings];
  warnings.length = 0;
  return result;
}

/**
 * Content width for debug display (matches Debug component)
 * Box width 80 - 2 borders - 4 padding = 74 chars
 */
const DISPLAY_CONTENT_WIDTH = 74;

/**
 * Join sections with separators matching display width
 */
function joinWithSeparators(sections: string[]): string {
  const separator = '-'.repeat(DISPLAY_CONTENT_WIDTH);
  return sections.join('\n\n' + separator + '\n\n');
}

/**
 * Format a single skill definition as summary markdown
 */
function formatSkillSummary(skill: SkillDefinition): string {
  const lines: string[] = [];

  lines.push(`### Name`);
  lines.push(skill.name);
  lines.push('');

  if (skill.steps.length > 0) {
    lines.push(`### Steps`);
    for (const step of skill.steps) {
      lines.push(`- ${step}`);
    }
    lines.push('');
  }

  if (skill.execution.length > 0) {
    lines.push(`### Execution`);
    for (const cmd of skill.execution) {
      lines.push(`- ${cmd}`);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Format skill definitions as summary for debug display
 * Shows only Name, Steps, and Execution with visual separators
 */
export function formatSkillsSummary(definitions: SkillDefinition[]): string {
  if (definitions.length === 0) {
    return '(no skills)';
  }

  const header = '## Available Skills';
  const skillSummaries = definitions.map(formatSkillSummary);
  return joinWithSeparators([header, ...skillSummaries]);
}

/**
 * Format skills section with visual separators for debug display
 * Layout: Header description -> separator -> skills separated by lines
 */
function formatSkillsForDisplay(formattedSkills: string): string {
  if (!formattedSkills) {
    return '(no skills)';
  }

  // Find the header (everything before first ### Name)
  const firstNameIndex = formattedSkills.search(/^###\s+Name/m);
  if (firstNameIndex === -1) {
    return '(no skills)';
  }

  const header = formattedSkills.slice(0, firstNameIndex).trim();
  const skillsContent = formattedSkills.slice(firstNameIndex);

  // Split by ### Name to get individual skills
  const skillParts = skillsContent
    .split(/(?=^###\s+Name)/m)
    .map((s) => s.trim())
    .filter(Boolean);

  if (skillParts.length === 0) {
    return '(no skills)';
  }

  // Join header and skills with separators
  return joinWithSeparators([header, ...skillParts]);
}

/**
 * Format prompt content based on the specified detail level
 *
 * - LLM: Returns header + base instructions + formatted skills (as sent to LLM)
 * - Skills: Returns header + skills with visual separators (no base instructions)
 * - Summary: Returns header + skill summaries (Name, Steps, Execution)
 */
export function formatPromptContent(
  toolName: string,
  command: string,
  baseInstructions: string,
  formattedSkills: string,
  mode: PromptDisplay,
  definitions?: SkillDefinition[]
): string {
  const header = ['', `Tool: ${toolName}`, `Command: ${command}`];

  switch (mode) {
    case PromptDisplay.LLM:
      return [...header, '', baseInstructions + formattedSkills].join('\n');

    case PromptDisplay.Skills: {
      // Layout: header -> separator -> skills with visual separators
      const headerString = header.join('\n');
      const skillsDisplay = formatSkillsForDisplay(formattedSkills);
      return joinWithSeparators([headerString, skillsDisplay]);
    }

    case PromptDisplay.Summary: {
      const headerString = header.join('\n');
      const summary = definitions
        ? formatSkillsSummary(definitions)
        : '(no skills)';
      return joinWithSeparators([headerString, summary]);
    }
  }
}

/**
 * Create debug component for system prompts sent to the LLM
 * Only creates at Verbose level
 *
 * @param toolName - Name of the tool being invoked
 * @param command - User command being processed
 * @param baseInstructions - Base tool instructions (without skills)
 * @param formattedSkills - Formatted skills section (as sent to LLM)
 * @param definitions - Parsed skill definitions for summary display
 */
export function logPrompt(
  toolName: string,
  command: string,
  baseInstructions: string,
  formattedSkills: string,
  definitions: SkillDefinition[] = []
): ComponentDefinition | null {
  if (currentDebugLevel !== DebugLevel.Verbose) {
    return null;
  }

  const content = formatPromptContent(
    toolName,
    command,
    baseInstructions,
    formattedSkills,
    PromptDisplay.Summary,
    definitions
  );

  // Calculate stats for the full prompt
  const fullPrompt = baseInstructions + formattedSkills;
  const lines = fullPrompt.split('\n').length;
  const bytes = Buffer.byteLength(fullPrompt, 'utf-8');
  const title = `SYSTEM PROMPT (${String(lines)} lines, ${String(bytes)} bytes)`;

  return createDebug({ title, content, color: Palette.Gray });
}

/**
 * Create debug component for LLM responses received
 * Only creates at Verbose level
 */
export function logResponse(
  toolName: string,
  response: unknown,
  durationMs: number
): ComponentDefinition | null {
  if (currentDebugLevel !== DebugLevel.Verbose) {
    return null;
  }

  const content = [
    '',
    `Tool: ${toolName}`,
    '',
    JSON.stringify(response, null, 2),
  ].join('\n');

  const title = `LLM RESPONSE (${String(durationMs)} ms)`;

  return createDebug({ title, content, color: Palette.LightGray });
}
