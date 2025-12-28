import { DebugLevel } from '../configuration/types.js';
import { ComponentDefinition } from '../types/components.js';

import { createDebugDefinition } from './components.js';
import { loadDebugSetting } from '../configuration/io.js';
import { Palette } from './colors.js';

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
 * Create debug component for system prompts sent to the LLM
 * Only creates at Verbose level
 */
export function logPrompt(
  toolName: string,
  command: string,
  instructions: string
): ComponentDefinition | null {
  if (currentDebugLevel !== DebugLevel.Verbose) {
    return null;
  }

  const content = [
    '',
    `Tool: ${toolName}`,
    `Command: ${command}`,
    '',
    instructions,
  ].join('\n');

  // Calculate stats for the instructions
  const lines = instructions.split('\n').length;
  const bytes = Buffer.byteLength(instructions, 'utf-8');
  const title = `SYSTEM PROMPT (${String(lines)} lines, ${String(bytes)} bytes)`;

  return createDebugDefinition(title, content, Palette.Gray);
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

  return createDebugDefinition(title, content, Palette.AshGray);
}
