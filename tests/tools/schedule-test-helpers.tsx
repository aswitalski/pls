import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import { render } from 'ink-testing-library';

import { Palette } from '../../src/services/colors.js';
import { formatSkillsForPrompt } from '../../src/services/skills.js';
import { ComponentStatus } from '../../src/types/components.js';
import type { ScheduledTask } from '../../src/types/types.js';
import { Debug } from '../../src/ui/Debug.js';

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

let basePromptShown = false;

/**
 * Show the base schedule prompt once
 */
export function renderBasePrompt(basePrompt: string): void {
  if (basePromptShown) return;
  basePromptShown = true;

  const lines = basePrompt.split('\n').length;
  const bytes = Buffer.byteLength(basePrompt, 'utf-8');

  const box = render(
    <Debug
      title={`SYSTEM PROMPT (${String(lines)} lines, ${String(bytes)} bytes)`}
      content={`\n${basePrompt}`}
      color={Palette.Gray}
      status={ComponentStatus.Done}
    />
  );
  console.log(box.lastFrame());
  box.unmount();
}

/**
 * Render compact prompt header with command and skills
 */
export function renderCompactPrompt(
  command: string,
  basePrompt: string,
  skillsMarkdown: string[]
): void {
  const skillsSection = formatSkillsForPrompt(skillsMarkdown);
  const totalLines = (basePrompt + skillsSection).split('\n').length;
  const totalBytes = Buffer.byteLength(basePrompt + skillsSection, 'utf-8');

  // Join raw skill markdown with separator
  const separator = '-'.repeat(64);
  const skillsContent = skillsMarkdown.join(`\n\n${separator}\n\n`);

  const content = [
    '',
    `Tool: schedule`,
    `Command: ${command}`,
    '',
    separator,
    '',
    skillsContent.trim(),
  ].join('\n');

  const box = render(
    <Debug
      title={`USER PROMPT (${String(totalLines)} lines, ${String(totalBytes)} bytes)`}
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
      color={Palette.AshGray}
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
