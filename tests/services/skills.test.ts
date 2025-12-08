import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  formatSkillsForComprehension,
  formatSkillsForPrompt,
  getSkillsDirectory,
  loadSkills,
  loadSkillsForComprehension,
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
      expect(skills[0]).toBe(skillContent);
    });

    it('loads multiple skill files', () => {
      const skillsDir = getSkillsDirectory();

      const skill1 = 'Skill 1 content';
      const skill2 = 'Skill 2 content';

      writeFileSync(join(skillsDir, 'skill1.md'), skill1, 'utf-8');
      writeFileSync(join(skillsDir, 'skill2.md'), skill2, 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(2);
      expect(skills).toContain(skill1);
      expect(skills).toContain(skill2);
    });

    it('ignores non-markdown files', () => {
      const skillsDir = getSkillsDirectory();

      writeFileSync(join(skillsDir, 'skill.md'), 'Skill content', 'utf-8');
      writeFileSync(join(skillsDir, 'readme.txt'), 'Not a skill', 'utf-8');
      writeFileSync(join(skillsDir, 'data.json'), '{}', 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(1);
      expect(skills[0]).toBe('Skill content');
    });

    it('handles both .md and .MD extensions', () => {
      const skillsDir = getSkillsDirectory();

      writeFileSync(join(skillsDir, 'skill1.md'), 'Lowercase', 'utf-8');
      writeFileSync(join(skillsDir, 'skill2.MD'), 'Uppercase', 'utf-8');

      const skills = loadSkills();
      expect(skills).toHaveLength(2);
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

  describe('Loading skills for comprehension', () => {
    it('returns empty array when no skills exist', () => {
      const skills = loadSkillsForComprehension();
      expect(skills).toEqual([]);
    });

    it('extracts only Name and Description sections', () => {
      const skillsDir = getSkillsDirectory();
      const skillContent = `### Name
Build Opera

### Description
Run Opera Desktop browser build

### Aliases
- build opera
- compile opera

### Steps
- Navigate to project directory
- Run generation script
- Compile the project

### Execution
- cd {project.path}
- ./generate.sh
- make build`;

      writeFileSync(join(skillsDir, 'opera.md'), skillContent, 'utf-8');

      const skills = loadSkillsForComprehension();
      expect(skills).toHaveLength(1);

      // Should include Name and Description
      expect(skills[0]).toContain('### Name');
      expect(skills[0]).toContain('Build Opera');
      expect(skills[0]).toContain('### Description');
      expect(skills[0]).toContain('Run Opera Desktop browser build');

      // Should NOT include other sections
      expect(skills[0]).not.toContain('### Aliases');
      expect(skills[0]).not.toContain('build opera');
      expect(skills[0]).not.toContain('### Steps');
      expect(skills[0]).not.toContain('Navigate to project directory');
      expect(skills[0]).not.toContain('### Execution');
      expect(skills[0]).not.toContain('cd {project.path}');
    });

    it('handles skills with only Name section', () => {
      const skillsDir = getSkillsDirectory();
      const skillContent = `### Name
Deploy Service

### Steps
- Deploy to production`;

      writeFileSync(join(skillsDir, 'deploy.md'), skillContent, 'utf-8');

      const skills = loadSkillsForComprehension();
      expect(skills).toHaveLength(1);
      expect(skills[0]).toContain('### Name');
      expect(skills[0]).toContain('Deploy Service');
      expect(skills[0]).not.toContain('### Steps');
    });

    it('handles multiple skills correctly', () => {
      const skillsDir = getSkillsDirectory();

      const skill1 = `### Name
Build Project

### Description
Build the project files

### Steps
- Compile`;

      const skill2 = `### Name
Test Project

### Description
Run all tests

### Execution
- npm test`;

      writeFileSync(join(skillsDir, 'build.md'), skill1, 'utf-8');
      writeFileSync(join(skillsDir, 'test.md'), skill2, 'utf-8');

      const skills = loadSkillsForComprehension();
      expect(skills).toHaveLength(2);

      // Both should have Name and Description only
      skills.forEach((skill) => {
        expect(skill).toContain('### Name');
        expect(skill).toContain('### Description');
        expect(skill).not.toContain('### Steps');
        expect(skill).not.toContain('### Execution');
      });
    });

    it('handles empty skill file', () => {
      const skillsDir = getSkillsDirectory();
      writeFileSync(join(skillsDir, 'empty.md'), '', 'utf-8');

      const skills = loadSkillsForComprehension();
      expect(skills).toHaveLength(1);
      expect(skills[0]).toBe('');
    });
  });

  describe('Formatting skills for comprehension', () => {
    it('returns empty string when no skills', () => {
      const formatted = formatSkillsForComprehension([]);
      expect(formatted).toBe('');
    });

    it('formats single skill with comprehension-specific header', () => {
      const skills = [
        `### Name
Build Opera

### Description
Run Opera Desktop browser build`,
      ];
      const formatted = formatSkillsForComprehension(skills);

      expect(formatted).toContain('## Available Skills');
      expect(formatted).toContain('The following skills are available');
      expect(formatted).toContain('help you match user requests');
      expect(formatted).toContain('Build Opera');
      expect(formatted).toContain('Run Opera Desktop browser build');
    });

    it('formats multiple skills separated by blank lines', () => {
      const skills = [
        `### Name
Skill 1

### Description
First skill`,
        `### Name
Skill 2

### Description
Second skill`,
        `### Name
Skill 3

### Description
Third skill`,
      ];
      const formatted = formatSkillsForComprehension(skills);

      expect(formatted).toContain('Skill 1');
      expect(formatted).toContain('Skill 2');
      expect(formatted).toContain('Skill 3');
      expect(formatted).toContain('\n\n');
    });

    it('does not include execution or steps instructions', () => {
      const skills = [
        `### Name
Test Skill

### Description
A test skill`,
      ];
      const formatted = formatSkillsForComprehension(skills);

      // Should not contain planning-specific instructions
      expect(formatted).not.toContain('incorporate the skill');
      expect(formatted).not.toContain('workflow');
      expect(formatted).not.toContain('INCOMPLETE');
    });
  });
});
