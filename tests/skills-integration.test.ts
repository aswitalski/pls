import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateExecuteTasks } from '../src/services/execution-validator.js';
import { expandSkillReferences } from '../src/services/skill-expander.js';
import {
  getSkillsDirectory,
  loadSkillDefinitions,
  loadSkillsWithValidation,
} from '../src/services/skills.js';
import { Task, TaskType } from '../src/types/types.js';

import { safeRemoveDirectory } from './test-utils.js';

describe('Skills integration - real-life scenarios', () => {
  let originalHome: string | undefined;
  let tempHome: string;
  let skillsDir: string;

  beforeEach(() => {
    originalHome = process.env.HOME;
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    tempHome = join(tmpdir(), `pls-skills-integration-${Date.now()}`);
    mkdirSync(tempHome, { recursive: true });
    process.env.HOME = tempHome;

    const plsDir = join(tempHome, '.pls');
    mkdirSync(plsDir, { recursive: true });
    skillsDir = join(plsDir, 'skills');
    mkdirSync(skillsDir, { recursive: true });
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    safeRemoveDirectory(tempHome);
  });

  describe('Deploying to multiple environments', () => {
    it('loads deployment skill with variant placeholders', () => {
      const deploySkill = `### Name
Deploy Application

### Description
Deploy the application to production or development environment

### Aliases
- deploy to production
- deploy to dev
- push to prod

### Config
deployment:
  prod:
    server: string
    path: string
  dev:
    server: string
    path: string

### Steps
- Build the application
- Upload to target server
- Restart the service

### Execution
- npm run build
- scp -r dist/* {deployment.VARIANT.server}:{deployment.VARIANT.path}
- ssh {deployment.VARIANT.server} "systemctl restart myapp"
`;

      writeFileSync(join(skillsDir, 'deploy.md'), deploySkill, 'utf-8');

      const skills = loadSkillDefinitions();
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('Deploy Application');
      expect(skills[0].isValid).toBe(true);
      expect(skills[0].execution).toHaveLength(3);
      expect(skills[0].execution[1]).toContain('{deployment.VARIANT.server}');
    });

    it('validates deployment skill requires config', () => {
      const deploySkill = `### Name
Deploy Application

### Description
Deploy the application to production or development environment

### Config
deployment:
  prod:
    server: string
    path: string

### Steps
- Upload to server

### Execution
- scp dist/* {deployment.prod.server}:{deployment.prod.path}
`;

      writeFileSync(join(skillsDir, 'deploy.md'), deploySkill, 'utf-8');

      const tasks: Task[] = [
        {
          action: 'Deploy to production',
          type: TaskType.Execute,
          params: {
            skill: 'Deploy Application',
          },
        },
      ];

      const result = validateExecuteTasks(tasks);

      // Should detect exactly 2 missing config paths
      expect(result.missingConfig.length).toBe(2);
      const paths = result.missingConfig.map((c) => c.path);
      expect(paths).toContain('deployment.prod.server');
      expect(paths).toContain('deployment.prod.path');
    });
  });

  describe('Skill composition with references', () => {
    it('expands nested skill references for build workflow', () => {
      const navigateSkill = `### Name
Navigate To Project

### Description
Change to the project directory

### Config
project:
  path: string

### Steps
- Navigate to project directory

### Execution
- cd {project.path}
`;

      const testSkill = `### Name
Run Tests

### Description
Execute the test suite

### Steps
- Navigate to project
- Run tests

### Execution
- [ Navigate To Project ]
- npm test
`;

      const buildSkill = `### Name
Build Project

### Description
Build the project with tests

### Steps
- Run tests first
- Build application

### Execution
- [ Run Tests ]
- npm run build
`;

      writeFileSync(join(skillsDir, 'navigate.md'), navigateSkill, 'utf-8');
      writeFileSync(join(skillsDir, 'test.md'), testSkill, 'utf-8');
      writeFileSync(join(skillsDir, 'build.md'), buildSkill, 'utf-8');

      const skills = loadSkillDefinitions();
      expect(skills).toHaveLength(3);

      const buildSkillDef = skills.find((s) => s.name === 'Build Project');
      expect(buildSkillDef).toBeDefined();

      if (!buildSkillDef) {
        throw new Error('Build Project skill not found');
      }

      const skillLookup = (name: string) =>
        skills.find((s) => s.name === name) || null;

      const expanded = expandSkillReferences(
        buildSkillDef.execution,
        skillLookup
      );

      // Should expand: Build → Run Tests → Navigate To Project
      expect(expanded).toEqual([
        'cd {project.path}',
        'npm test',
        'npm run build',
      ]);
    });

    it('detects circular references in skill composition', () => {
      const skillA = `### Name
Skill A

### Description
References Skill B

### Steps
- Do something

### Execution
- [ Skill B ]
`;

      const skillB = `### Name
Skill B

### Description
References Skill A

### Steps
- Do something

### Execution
- [ Skill A ]
`;

      writeFileSync(join(skillsDir, 'skill-a.md'), skillA, 'utf-8');
      writeFileSync(join(skillsDir, 'skill-b.md'), skillB, 'utf-8');

      const skills = loadSkillDefinitions();
      const skillLookup = (name: string) =>
        skills.find((s) => s.name === name) || null;

      const skillADef = skills.find((s) => s.name === 'Skill A');

      expect(skillADef).toBeDefined();

      if (!skillADef) {
        throw new Error('Skill A not found');
      }

      expect(() => {
        expandSkillReferences(skillADef.execution, skillLookup);
      }).toThrow('Circular skill reference detected');
    });

    it('detects longer circular reference chains', () => {
      const skillA = `### Name
Skill A

### Description
References Skill B in a longer chain

### Steps
- Do something

### Execution
- [ Skill B ]
`;

      const skillB = `### Name
Skill B

### Description
References Skill C in a longer chain

### Steps
- Do something

### Execution
- [ Skill C ]
`;

      const skillC = `### Name
Skill C

### Description
References Skill A to complete the cycle

### Steps
- Do something

### Execution
- [ Skill A ]
`;

      writeFileSync(join(skillsDir, 'skill-a.md'), skillA, 'utf-8');
      writeFileSync(join(skillsDir, 'skill-b.md'), skillB, 'utf-8');
      writeFileSync(join(skillsDir, 'skill-c.md'), skillC, 'utf-8');

      const skills = loadSkillDefinitions();
      const skillLookup = (name: string) =>
        skills.find((s) => s.name === name) || null;

      const skillADef = skills.find((s) => s.name === 'Skill A');

      expect(skillADef).toBeDefined();

      if (!skillADef) {
        throw new Error('Skill A not found');
      }

      expect(() => {
        expandSkillReferences(skillADef.execution, skillLookup);
      }).toThrow('Circular skill reference detected');
    });
  });

  describe('Incomplete skills handling', () => {
    it('marks skill with short description as incomplete', () => {
      const incompleteSkill = `### Name
Quick Task

### Description
TODO

### Steps
- Do something

### Execution
- echo "hello"
`;

      writeFileSync(join(skillsDir, 'incomplete.md'), incompleteSkill, 'utf-8');

      const skills = loadSkillDefinitions();
      expect(skills).toHaveLength(1);
      expect(skills[0].isValid).toBe(true);
      expect(skills[0].isIncomplete).toBe(true);
    });

    it('adds INCOMPLETE marker to skill markdown', () => {
      const incompleteSkill = `### Name
Quick Task

### Description
Short

### Steps
- Do something

### Execution
- echo "hello"
`;

      writeFileSync(join(skillsDir, 'incomplete.md'), incompleteSkill, 'utf-8');

      const markedSkills = loadSkillsWithValidation();
      expect(markedSkills).toHaveLength(1);
      expect(markedSkills[0]).toContain('(INCOMPLETE)');
      expect(markedSkills[0]).toContain('Quick Task (INCOMPLETE)');
    });

    it('adds INCOMPLETE marker to invalid skill markdown', () => {
      const invalidSkill = `### Name
Invalid Skill

### Description
Missing execution section

### Steps
- Do something
`;

      writeFileSync(join(skillsDir, 'invalid.md'), invalidSkill, 'utf-8');

      const markedSkills = loadSkillsWithValidation();
      expect(markedSkills).toHaveLength(1);
      expect(markedSkills[0]).toContain('(INCOMPLETE)');
      expect(markedSkills[0]).toContain('Invalid Skill (INCOMPLETE)');
    });

    it('does not mark skill with adequate description', () => {
      const completeSkill = `### Name
Complete Task

### Description
This is a well-documented skill with sufficient description

### Steps
- Do something

### Execution
- echo "hello"
`;

      writeFileSync(join(skillsDir, 'complete.md'), completeSkill, 'utf-8');

      const skills = loadSkillDefinitions();
      expect(skills).toHaveLength(1);
      expect(skills[0].isValid).toBe(true);
      expect(skills[0].isIncomplete).toBeUndefined();

      const markedSkills = loadSkillsWithValidation();
      expect(markedSkills[0]).not.toContain('(INCOMPLETE)');
    });
  });

  describe('Validation errors during execution', () => {
    it('detects invalid skill during execution validation', () => {
      const invalidSkill = `### Name
Broken Skill

### Description
Missing execution

### Steps
- Step 1
- Step 2
`;

      writeFileSync(join(skillsDir, 'broken.md'), invalidSkill, 'utf-8');

      const tasks: Task[] = [
        {
          action: 'Run broken skill',
          type: TaskType.Execute,
          params: {
            skill: 'Broken Skill',
          },
        },
      ];

      const result = validateExecuteTasks(tasks);

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].skill).toBe('Broken Skill');
      expect(result.validationErrors[0].issues).toHaveLength(1);
      expect(result.validationErrors[0].issues[0]).toContain(
        'missing an Execution section'
      );
    });

    it('detects mismatched steps and execution counts', () => {
      const mismatchedSkill = `### Name
Mismatched Skill

### Description
Steps and execution counts do not match

### Steps
- Step 1
- Step 2
- Step 3

### Execution
- command 1
- command 2
`;

      writeFileSync(join(skillsDir, 'mismatched.md'), mismatchedSkill, 'utf-8');

      const tasks: Task[] = [
        {
          action: 'Run mismatched skill',
          type: TaskType.Execute,
          params: {
            skill: 'Mismatched Skill',
          },
        },
      ];

      const result = validateExecuteTasks(tasks);

      expect(result.validationErrors).toHaveLength(1);
      expect(result.validationErrors[0].issues[0]).toContain(
        '3 steps but 2 execution'
      );
    });
  });

  describe('Multi-environment workflow', () => {
    it('handles complete deployment workflow with environments', () => {
      const deploySkill = `### Name
Deploy To Environment

### Description
Complete deployment workflow for production and staging environments with all necessary steps

### Config
app:
  prod:
    server: string
    path: string
    branch: string
  staging:
    server: string
    path: string
    branch: string

### Steps
- Checkout correct branch
- Run tests
- Build application
- Deploy to server
- Run health check

### Execution
- git checkout {app.VARIANT.branch}
- npm test
- npm run build
- scp -r dist/* {app.VARIANT.server}:{app.VARIANT.path}
- curl -f {app.VARIANT.server}/health || exit 1
`;

      writeFileSync(join(skillsDir, 'deploy-env.md'), deploySkill, 'utf-8');

      const skills = loadSkillDefinitions();
      const skill = skills[0];

      expect(skill.name).toBe('Deploy To Environment');
      expect(skill.isValid).toBe(true);
      expect(skill.isIncomplete).toBeUndefined();
      expect(skill.execution).toHaveLength(5);
      expect(skill.config).toBeDefined();
      expect(skill.config?.app).toBeDefined();
    });
  });

  describe('Real-world database migration workflow', () => {
    it('validates database migration skill with multiple checks', () => {
      const migrationSkill = `### Name
Run Database Migration

### Description
Execute database migrations with backup and rollback support for production and development environments

### Config
database:
  prod:
    host: string
    name: string
  dev:
    host: string
    name: string

### Steps
- Backup database
- Run migrations
- Verify migration
- Cleanup

### Execution
- pg_dump -h {database.VARIANT.host} {database.VARIANT.name} > backup.sql
- npm run migrate
- psql -h {database.VARIANT.host} {database.VARIANT.name} -c "SELECT version FROM migrations ORDER BY version DESC LIMIT 1;"
- rm backup.sql
`;

      writeFileSync(join(skillsDir, 'migrate.md'), migrationSkill, 'utf-8');

      const skills = loadSkillDefinitions();
      const skill = skills[0];

      expect(skill.name).toBe('Run Database Migration');
      expect(skill.isValid).toBe(true);
      expect(skill.steps).toHaveLength(4);
      expect(skill.execution).toHaveLength(4);

      // Verify placeholders are present
      expect(skill.execution[0]).toContain('{database.VARIANT.host}');
      expect(skill.execution[0]).toContain('{database.VARIANT.name}');
    });
  });

  describe('Skill with labeled commands', () => {
    it('parses skill with labeled execution commands', () => {
      const labeledSkill = `### Name
Setup Development Environment

### Description
Initialize development environment with all necessary tools and dependencies

### Steps
- Install dependencies
- Setup database
- Configure environment

### Execution
- Install: npm install
- Setup: docker-compose up -d postgres
- Configure: cp .env.example .env
`;

      writeFileSync(join(skillsDir, 'setup.md'), labeledSkill, 'utf-8');

      const skills = loadSkillDefinitions();
      const skill = skills[0];

      expect(skill.isValid).toBe(true);
      expect(skill.execution).toEqual([
        'Install: npm install',
        'Setup: docker-compose up -d postgres',
        'Configure: cp .env.example .env',
      ]);
    });
  });

  describe('Config validation across skill references', () => {
    it('collects config requirements from nested skill references', () => {
      const baseSkill = `### Name
Connect To Database

### Description
Establish database connection

### Config
db:
  host: string
  port: number

### Steps
- Connect

### Execution
- psql -h {db.host} -p {db.port}
`;

      const wrapperSkill = `### Name
Run Query

### Description
Connect and run database query

### Steps
- Connect to database
- Execute query

### Execution
- [ Connect To Database ]
- psql -c "SELECT * FROM users"
`;

      writeFileSync(join(skillsDir, 'db-connect.md'), baseSkill, 'utf-8');
      writeFileSync(join(skillsDir, 'db-query.md'), wrapperSkill, 'utf-8');

      const tasks: Task[] = [
        {
          action: 'Run database query',
          type: TaskType.Execute,
          params: {
            skill: 'Run Query',
          },
        },
      ];

      const result = validateExecuteTasks(tasks);

      // Should detect missing config from nested reference
      expect(result.missingConfig.length).toBeGreaterThan(0);
      const paths = result.missingConfig.map((c) => c.path);
      expect(paths).toContain('db.host');
      expect(paths).toContain('db.port');
    });
  });

  describe('Skills directory management', () => {
    it('returns correct skills directory path', () => {
      const dir = getSkillsDirectory();
      expect(dir).toBe(join(tempHome, '.pls', 'skills'));
    });

    it('handles missing skills directory gracefully', () => {
      // Remove skills directory
      safeRemoveDirectory(skillsDir);

      const skills = loadSkillDefinitions();
      expect(skills).toEqual([]);
    });

    it('handles empty skills directory', () => {
      // Skills directory exists but contains no .md files
      // (it's already empty from beforeEach, so just verify)
      const skills = loadSkillDefinitions();
      expect(skills).toEqual([]);

      // Verify the directory itself exists
      expect(existsSync(skillsDir)).toBe(true);
    });

    it('loads multiple skills with mixed validity', () => {
      const validSkill = `### Name
Valid Skill

### Description
This skill is complete and valid with proper structure

### Steps
- Do something

### Execution
- echo "valid"
`;

      const incompleteSkill = `### Name
Incomplete Skill

### Description
Short

### Steps
- Do something

### Execution
- echo "incomplete"
`;

      const invalidSkill = `### Name
Invalid Skill

### Description
Missing execution

### Steps
- Do something
`;

      writeFileSync(join(skillsDir, 'valid.md'), validSkill, 'utf-8');
      writeFileSync(join(skillsDir, 'incomplete.md'), incompleteSkill, 'utf-8');
      writeFileSync(join(skillsDir, 'invalid.md'), invalidSkill, 'utf-8');

      const skills = loadSkillDefinitions();
      expect(skills).toHaveLength(3);

      const valid = skills.find((s) => s.name === 'Valid Skill');
      const incomplete = skills.find((s) => s.name === 'Incomplete Skill');
      const invalid = skills.find((s) => s.name === 'Invalid Skill');

      expect(valid?.isValid).toBe(true);
      expect(valid?.isIncomplete).toBeUndefined();

      expect(incomplete?.isValid).toBe(true);
      expect(incomplete?.isIncomplete).toBe(true);

      expect(invalid?.isValid).toBe(false);
      expect(invalid?.isIncomplete).toBe(true);
    });
  });
});
