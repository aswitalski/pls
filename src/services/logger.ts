import { homedir, platform } from 'os';
import { dirname, join } from 'path';

import { DebugLevel } from '../configuration/types.js';
import { ComponentDefinition } from '../types/components.js';
import { SkillDefinition } from '../types/skills.js';

import { loadDebugSetting } from '../configuration/io.js';
import { Palette } from './colors.js';
import { createDebug } from './components.js';
import { defaultFileSystem, FileSystem } from './filesystem.js';

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
 * Content width for debug display (matches Debug component)
 * Box width 80 - 2 borders - 4 padding = 74 chars
 */
const DISPLAY_CONTENT_WIDTH = 74;

/**
 * File logging configuration
 */
const LOGS_DIR = join(homedir(), '.pls', 'logs');

/**
 * Whether running on Windows (affects filename separators)
 */
const IS_WINDOWS = platform() === 'win32';

/**
 * Maximum number of letter suffixes (a-z) for unique filenames
 */
const MAX_LETTER_SUFFIXES = 26;

/**
 * Pad a number with leading zeros to the specified width
 */
const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/**
 * Current session's log file path (null until first log entry)
 */
let currentLogFile: string | null = null;

/**
 * Filesystem instance for file operations (injectable for testing)
 */
let fileSystem: FileSystem = defaultFileSystem;

/**
 * Set the filesystem instance (used for testing)
 */
export function setFileSystem(fs: FileSystem): void {
  fileSystem = fs;
}

/**
 * Reset the session log file (used for testing)
 */
export function resetSessionLog(): void {
  currentLogFile = null;
}

/**
 * Generate a timestamped log file path using local time
 * Format: ~/.pls/logs/YYYY-MM-DD/HH:MM:SS.log.md (HH-MM-SS on Windows)
 */
function getLogFilePath(): string {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const separator = IS_WINDOWS ? '-' : ':';
  const time = `${pad(now.getHours())}${separator}${pad(now.getMinutes())}${separator}${pad(now.getSeconds())}`;

  return join(LOGS_DIR, date, `${time}.log.md`);
}

/**
 * Generate a unique log file path by adding suffix if file exists
 */
function getUniqueLogFilePath(basePath: string): string {
  if (!fileSystem.exists(basePath)) {
    return basePath;
  }

  const dir = dirname(basePath);
  const ext = '.log.md';
  const name = basePath.slice(dir.length + 1, -ext.length);

  for (let i = 0; i < MAX_LETTER_SUFFIXES; i++) {
    const suffix = String.fromCharCode(97 + i); // a-z
    const candidate = join(dir, `${name}-${suffix}${ext}`);
    if (!fileSystem.exists(candidate)) {
      return candidate;
    }
  }

  // Fallback: use milliseconds for uniqueness (avoids overwriting)
  return join(dir, `${name}-${pad(new Date().getMilliseconds(), 3)}${ext}`);
}

/**
 * Initialize the session log file if not already created
 */
function initializeSessionLog(): boolean {
  if (currentLogFile) return true;

  try {
    const basePath = getLogFilePath();
    const logDir = dirname(basePath);
    if (!fileSystem.exists(logDir)) {
      fileSystem.createDirectory(logDir, { recursive: true });
    }
    const logPath = getUniqueLogFilePath(basePath);
    fileSystem.writeFile(logPath, '');
    currentLogFile = logPath;
    return true;
  } catch {
    return false;
  }
}

/**
 * Append content to the current session's log file
 */
function appendToLog(content: string): void {
  if (!initializeSessionLog() || !currentLogFile) return;

  try {
    fileSystem.appendFile(currentLogFile, content);
  } catch {
    // Silently fail - logging should not crash the app
  }
}

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
  switch (mode) {
    case PromptDisplay.LLM: {
      const header = ['', `**Tool:** ${toolName}`];
      return [...header, '', baseInstructions + formattedSkills].join('\n');
    }

    case PromptDisplay.Skills: {
      const header = `\nTool: ${toolName}\nCommand: ${command}`;
      const skillsDisplay = formatSkillsForDisplay(formattedSkills);
      return joinWithSeparators([header, skillsDisplay]);
    }

    case PromptDisplay.Summary: {
      const header = `\nTool: ${toolName}\nCommand: ${command}`;
      const summary = definitions
        ? formatSkillsSummary(definitions)
        : '(no skills)';
      return joinWithSeparators([header, summary]);
    }
  }
}

/**
 * Create debug component for system prompts sent to the LLM
 * Creates UI component at Verbose level, writes to file at Info or Verbose
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
  // Write to file at Info or Verbose level (full LLM format)
  if (currentDebugLevel !== DebugLevel.None) {
    const userPrompt = `# User Command\n\n\`\`\`\n${command}\n\`\`\`\n\n`;
    const fileContent = formatPromptContent(
      toolName,
      command,
      baseInstructions,
      formattedSkills,
      PromptDisplay.LLM
    );
    appendToLog(userPrompt + '# System Prompt\n' + fileContent + '\n\n');
  }

  // Create UI component only at Verbose level
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
 * Creates UI component at Verbose level, writes to file at Info or Verbose
 */
export function logResponse(
  toolName: string,
  response: unknown,
  durationMs: number
): ComponentDefinition | null {
  const jsonContent = JSON.stringify(response, null, 2);

  // Write to file at Info or Verbose level (markdown format)
  if (currentDebugLevel !== DebugLevel.None) {
    const fileContent = [
      '',
      `**Tool:** ${toolName}`,
      '',
      '```json',
      jsonContent,
      '```',
    ].join('\n');
    appendToLog('# LLM Response\n' + fileContent + '\n\n');
  }

  // Create UI component only at Verbose level
  if (currentDebugLevel !== DebugLevel.Verbose) {
    return null;
  }

  const content = ['', `Tool: ${toolName}`, '', jsonContent].join('\n');
  const title = `LLM RESPONSE (${String(durationMs)} ms)`;

  return createDebug({ title, content, color: Palette.LightGray });
}
