import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
  } catch (error) {
    // Return empty array if there's any error reading the directory
    return [];
  }
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

`;

  const skillsContent = skills.join('\n\n');

  return header + skillsContent;
}
