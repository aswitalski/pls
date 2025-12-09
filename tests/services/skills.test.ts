import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  formatSkillsForPrompt,
  getSkillsDirectory,
  loadSkills,
} from '../../src/services/skills.js';

import { safeRemoveDirectory } from '../test-utils.js';

describe('Skills service', () => {
  let originalHome: string | undefined;
  let tempHome: string;

  beforeEach(() => {
    // Mock HOME to point to temp directory
    originalHome = process.env.HOME;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    tempHome = join(tmpdir(), `pls-home-test-${Date.now()}`);
    mkdirSync(tempHome, { recursive: true });
    process.env.HOME = tempHome;

    // Create .pls/skills directory structure
    const plsDir = join(tempHome, '.pls');
    mkdirSync(plsDir, { recursive: true });
    mkdirSync(join(plsDir, 'skills'), { recursive: true });
  });

  afterEach(() => {
    // Restore original HOME first
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }

    // Clean up temp directory using safe utility
    safeRemoveDirectory(tempHome);
  });

  describe('Getting skills directory', () => {
    it('returns path to .pls/skills in home directory', () => {
      const skillsDir = getSkillsDirectory();
      expect(skillsDir).toContain('.pls');
      expect(skillsDir).toContain('skills');
    });
  });

  describe('Loading skills', () => {
    it('returns empty array when skills directory does not exist', () => {
      // Remove the skills directory
      const skillsDir = getSkillsDirectory();
      if (existsSync(skillsDir)) {
        rmSync(skillsDir, { recursive: true, force: true });
      }

      const skills = loadSkills();
      expect(skills).toEqual([]);
    });

    it('returns empty array when skills directory is empty', () => {
      const skills = loadSkills();
      expect(skills).toEqual([]);
    });

    it('loads single skill file', () => {
      const skillsDir = getSkillsDirectory();
      const skillContent = `### Name
Build Opera

### Description
Run Opera Desktop browser build

### Steps
Navigate to the project directory, run the project generation script, run the compilation`;

      writeFileSync(join(skillsDir, 'opera.md'), skillContent, 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0]).toEqual({ key: 'opera', content: skillContent });
    });

    it('loads multiple skill files', () => {
      const skillsDir = getSkillsDirectory();

      const skill1 = 'Skill 1 content';
      const skill2 = 'Skill 2 content';

      writeFileSync(join(skillsDir, 'skill1.md'), skill1, 'utf-8');
      writeFileSync(join(skillsDir, 'skill2.md'), skill2, 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(2);
      expect(skills).toContainEqual({ key: 'skill1', content: skill1 });
      expect(skills).toContainEqual({ key: 'skill2', content: skill2 });
    });

    it('ignores non-markdown files', () => {
      const skillsDir = getSkillsDirectory();

      writeFileSync(join(skillsDir, 'skill.md'), 'Skill content', 'utf-8');
      writeFileSync(join(skillsDir, 'readme.txt'), 'Not a skill', 'utf-8');
      writeFileSync(join(skillsDir, 'data.json'), '{}', 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0]).toEqual({ key: 'skill', content: 'Skill content' });
    });

    it('handles both .md and .MD extensions', () => {
      const skillsDir = getSkillsDirectory();

      writeFileSync(join(skillsDir, 'skill1.md'), 'Lowercase', 'utf-8');
      writeFileSync(join(skillsDir, 'skill2.MD'), 'Uppercase', 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(2);
      expect(skills[0]).toEqual({ key: 'skill1', content: 'Lowercase' });
      expect(skills[1]).toEqual({ key: 'skill2', content: 'Uppercase' });
    });
  });

  describe('Formatting skills for prompt', () => {
    it('returns empty string when no skills', () => {
      const formatted = formatSkillsForPrompt([]);
      expect(formatted).toBe('');
    });

    it('formats single skill with header', () => {
      const skills = [
        `### Name
Skill 1

### Description
First skill

### Steps
- Step one

### Execution
- cmd one`,
      ];
      const formatted = formatSkillsForPrompt(skills);

      expect(formatted).toContain('## Available Skills');
      expect(formatted).toContain(
        'The following skills define domain-specific workflows'
      );
      expect(formatted).toContain('Skill 1');
    });

    it('formats multiple skills separated by blank lines', () => {
      const skills = [
        `### Name
Skill 1

### Description
First skill

### Steps
- Step one

### Execution
- cmd one`,
        `### Name
Skill 2

### Description
Second skill

### Steps
- Step two

### Execution
- cmd two`,
        `### Name
Skill 3

### Description
Third skill

### Steps
- Step three

### Execution
- cmd three`,
      ];
      const formatted = formatSkillsForPrompt(skills);

      expect(formatted).toContain('Skill 1');
      expect(formatted).toContain('Skill 2');
      expect(formatted).toContain('Skill 3');
      expect(formatted).toContain('\n\n');
    });
  });
});
