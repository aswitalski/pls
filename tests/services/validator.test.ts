import { homedir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileSystem } from '../../src/services/filesystem.js';
import { validateExecuteTasks } from '../../src/services/validator.js';
import { Task, TaskType } from '../../src/types/types.js';

describe('Validating execute tasks', () => {
  let fs: MemoryFileSystem;
  let skillsDir: string;
  let configPath: string;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    const plsDir = join(homedir(), '.pls');
    skillsDir = join(plsDir, 'skills');
    configPath = join(homedir(), '.plsrc');
    fs.createDirectory(skillsDir, { recursive: true });
  });

  describe('Tasks without skills', () => {
    it('handles tasks without skill params', () => {
      const tasks: Task[] = [
        {
          action: 'Generic command',
          type: TaskType.Execute,
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toEqual([]);
      expect(result.validationErrors).toEqual([]);
    });

    it('handles tasks without config array', () => {
      const tasks: Task[] = [
        {
          action: 'Run npm install',
          type: TaskType.Execute,
          params: { command: 'npm install' },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toEqual([]);
      expect(result.validationErrors).toEqual([]);
    });
  });

  describe('Config path validation', () => {
    it('detects missing config paths from task config array', () => {
      const tasks: Task[] = [
        {
          action: 'Navigate to project',
          type: TaskType.Execute,
          config: ['project.alpha.path'],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toHaveLength(1);
      expect(result.missingConfig[0].path).toBe('project.alpha.path');
    });

    it('returns empty missing when config exists', () => {
      fs.writeFile(
        configPath,
        `
project:
  alpha:
    path: /data/alpha
`
      );

      const tasks: Task[] = [
        {
          action: 'Navigate to project',
          type: TaskType.Execute,
          config: ['project.alpha.path'],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toEqual([]);
    });

    it('detects multiple missing config paths', () => {
      const tasks: Task[] = [
        {
          action: 'Task 1',
          type: TaskType.Execute,
          config: ['project.alpha.path'],
        },
        {
          action: 'Task 2',
          type: TaskType.Execute,
          config: ['project.beta.repo'],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toHaveLength(2);
      const paths = result.missingConfig.map((c) => c.path);
      expect(paths).toContain('project.alpha.path');
      expect(paths).toContain('project.beta.repo');
    });

    it('deduplicates config checks across multiple tasks', () => {
      const tasks: Task[] = [
        {
          action: 'Navigate to project',
          type: TaskType.Execute,
          config: ['project.alpha.path'],
        },
        {
          action: 'Build in project',
          type: TaskType.Execute,
          config: ['project.alpha.path'],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toHaveLength(1);
      expect(result.missingConfig[0].path).toBe('project.alpha.path');
    });

    it('handles mix of existing and missing config paths', () => {
      fs.writeFile(
        configPath,
        `
project:
  alpha:
    path: /data/alpha
`
      );

      const tasks: Task[] = [
        {
          action: 'Task with existing config',
          type: TaskType.Execute,
          config: ['project.alpha.path'],
        },
        {
          action: 'Task with missing config',
          type: TaskType.Execute,
          config: ['project.beta.path'],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toHaveLength(1);
      expect(result.missingConfig[0].path).toBe('project.beta.path');
    });
  });

  describe('Skill validation', () => {
    it('handles tasks with non-existent skill gracefully', () => {
      const tasks: Task[] = [
        {
          action: 'Build something',
          type: TaskType.Execute,
          params: {
            skill: 'Non-Existent Skill',
            variant: 'alpha',
          },
        },
      ];

      expect(() => validateExecuteTasks(tasks, fs)).not.toThrow();
    });

    it('returns validation error for invalid skill', () => {
      // Create an invalid skill (missing Steps section)
      // Filename must match kebab-case of skill name for lookup to work
      const invalidSkill = `### Name
Invalid Skill

### Description
This skill is missing required sections
`;
      fs.writeFile(join(skillsDir, 'invalid-skill.md'), invalidSkill);

      const tasks: Task[] = [
        {
          action: 'Use invalid skill',
          type: TaskType.Execute,
          params: { skill: 'Invalid Skill' },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].skill).toBe('Invalid Skill');
      expect(result.validationErrors[0].issues.length).toBeGreaterThan(0);
    });

    it('returns empty validation errors for valid skill', () => {
      const validSkill = `### Name
Valid Skill

### Description
A properly defined skill with all sections

### Steps
- Step one
- Step two

### Execution
- command one
- command two
`;
      fs.writeFile(join(skillsDir, 'valid-skill.md'), validSkill);

      const tasks: Task[] = [
        {
          action: 'Use valid skill',
          type: TaskType.Execute,
          params: { skill: 'Valid Skill' },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toEqual([]);
    });

    it('deduplicates skill validation across tasks', () => {
      const invalidSkill = `### Name
Bad Skill

### Description
Missing required sections
`;
      fs.writeFile(join(skillsDir, 'bad-skill.md'), invalidSkill);

      const tasks: Task[] = [
        {
          action: 'First use',
          type: TaskType.Execute,
          params: { skill: 'Bad Skill' },
        },
        {
          action: 'Second use',
          type: TaskType.Execute,
          params: { skill: 'Bad Skill' },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(1);
    });

    it('returns early with validation errors before checking config', () => {
      const invalidSkill = `### Name
Broken Skill

### Description
Missing steps
`;
      fs.writeFile(join(skillsDir, 'broken-skill.md'), invalidSkill);

      const tasks: Task[] = [
        {
          action: 'Use broken skill',
          type: TaskType.Execute,
          params: { skill: 'Broken Skill' },
          config: ['some.missing.config'],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      // Should have validation errors
      expect(result.validationErrors.length).toBeGreaterThan(0);
      // Config validation should not run (returns early)
      expect(result.missingConfig).toEqual([]);
    });
  });

  describe('Empty and edge cases', () => {
    it('handles empty task array', () => {
      const result = validateExecuteTasks([], fs);

      expect(result.missingConfig).toEqual([]);
      expect(result.validationErrors).toEqual([]);
    });

    it('handles tasks with empty config array', () => {
      const tasks: Task[] = [
        {
          action: 'Task with empty config',
          type: TaskType.Execute,
          config: [],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.missingConfig).toEqual([]);
    });

    it('skips non-string config entries', () => {
      const tasks: Task[] = [
        {
          action: 'Task with mixed config',
          type: TaskType.Execute,
          config: [
            'valid.path',
            null as unknown as string,
            123 as unknown as string,
          ],
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      // Should only check the valid string path
      expect(result.missingConfig).toHaveLength(1);
      expect(result.missingConfig[0].path).toBe('valid.path');
    });
  });
});
