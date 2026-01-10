import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { render } from 'ink-testing-library';

import type { ScheduledTask } from '../../../src/types/types.js';
import type { SkillDefinition } from '../../../src/types/skills.js';
import { ComponentStatus } from '../../../src/types/components.js';

import { Palette } from '../../../src/services/colors.js';
import {
  formatPromptContent,
  PromptDisplay,
} from '../../../src/services/logger.js';
import { parseSkillMarkdown } from '../../../src/services/parser.js';
import { formatSkillsForPrompt } from '../../../src/services/skills.js';

import { Debug } from '../../../src/components/views/Debug.js';

export const LLM_TEST_TIMEOUT = 30000;

/**
 * Load skills from test fixtures directory
 */
export function loadTestSkills(skillNames: string[]): string[] {
  const fixturesDir = join(process.cwd(), 'tests', 'fixtures', 'skills');

  return skillNames.map((skillFile) => {
    const filePath = join(fixturesDir, skillFile);
    return readFileSync(filePath, 'utf-8');
  });
}

/**
 * Load skills as structured definitions from test fixtures
 */
export function loadTestSkillDefinitions(
  skillNames: string[]
): SkillDefinition[] {
  const fixturesDir = join(process.cwd(), 'tests', 'fixtures', 'skills');

  return skillNames.map((skillFile) => {
    const filePath = join(fixturesDir, skillFile);
    const content = readFileSync(filePath, 'utf-8');
    // Derive key from filename (remove extension)
    const key = skillFile.replace(/\.md$/i, '');
    return parseSkillMarkdown(key, content);
  });
}

/**
 * Render compact prompt header with command and skills only
 * Uses Summary mode for compact test output
 */
export function renderCompactPrompt(
  command: string,
  basePrompt: string,
  skillsMarkdown: string[],
  skillFileNames: string[] = []
): void {
  const formattedSkills = formatSkillsForPrompt(skillsMarkdown);
  const fullInstructions = basePrompt + formattedSkills;
  const totalLines = fullInstructions.split('\n').length;
  const totalBytes = Buffer.byteLength(fullInstructions, 'utf-8');

  // Load definitions from skill files for Summary mode
  const definitions = loadTestSkillDefinitions(skillFileNames);

  // Use Summary mode for compact test output
  const content = formatPromptContent(
    'schedule',
    command,
    basePrompt,
    formattedSkills,
    PromptDisplay.Summary,
    definitions
  );

  const box = render(
    <Debug
      title={`SYSTEM PROMPT (${String(totalLines)} lines, ${String(totalBytes)} bytes)`}
      content={content}
      color={Palette.Gray}
      status={ComponentStatus.Done}
    />
  );
  console.log(box.lastFrame());
  box.unmount();
}

/**
 * Render LLM response
 */
export function renderResponse(duration: number, response: unknown): void {
  const responseContent = [
    '',
    `Tool: schedule`,
    '',
    JSON.stringify(response, null, 2),
  ].join('\n');

  const responseBox = render(
    <Debug
      title={`LLM RESPONSE (${String(duration)} ms)`}
      content={responseContent}
      color={Palette.LightGray}
      status={ComponentStatus.Done}
    />
  );
  console.log(responseBox.lastFrame());
  responseBox.unmount();
}

/**
 * Get all leaf tasks recursively
 */
export function getAllLeafTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  const leafTasks: ScheduledTask[] = [];
  for (const task of tasks) {
    if (!task.subtasks || task.subtasks.length === 0) {
      leafTasks.push(task);
    } else {
      leafTasks.push(...getAllLeafTasks(task.subtasks));
    }
  }
  return leafTasks;
}
