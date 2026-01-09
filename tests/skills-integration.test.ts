import { homedir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileSystem } from '../src/services/filesystem.js';
import { validateExecuteTasks } from '../src/services/validator.js';
import {
  expandSkillReferences,
  getSkillsDirectory,
  loadSkillDefinitions,
  loadSkillsWithValidation,
} from '../src/services/skills.js';
import { Task, TaskType } from '../src/types/types.js';

describe('Skills integration - real-life scenarios', () => {
  let fs: MemoryFileSystem;
  let skillsDir: string;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    const plsDir = join(homedir(), '.pls');
    skillsDir = join(plsDir, 'skills');
    fs.createDirectory(skillsDir, { recursive: true });
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

      fs.writeFile(join(skillsDir, 'deploy.md'), deploySkill);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'deploy-application.md'), deploySkill);

      const tasks: Task[] = [
        {
          action: 'Deploy to production',
          type: TaskType.Execute,
          step: 1,
          config: ['deployment.prod.server', 'deployment.prod.path'],
          params: {
            skill: 'Deploy Application',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

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

      fs.writeFile(join(skillsDir, 'navigate.md'), navigateSkill);
      fs.writeFile(join(skillsDir, 'test.md'), testSkill);
      fs.writeFile(join(skillsDir, 'build.md'), buildSkill);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'skill-a.md'), skillA);
      fs.writeFile(join(skillsDir, 'skill-b.md'), skillB);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'skill-a.md'), skillA);
      fs.writeFile(join(skillsDir, 'skill-b.md'), skillB);
      fs.writeFile(join(skillsDir, 'skill-c.md'), skillC);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'incomplete.md'), incompleteSkill);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'incomplete.md'), incompleteSkill);

      const markedSkills = loadSkillsWithValidation(fs);
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

      fs.writeFile(join(skillsDir, 'invalid.md'), invalidSkill);

      const markedSkills = loadSkillsWithValidation(fs);
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

      fs.writeFile(join(skillsDir, 'complete.md'), completeSkill);

      const skills = loadSkillDefinitions(fs);
      expect(skills).toHaveLength(1);
      expect(skills[0].isValid).toBe(true);
      expect(skills[0].isIncomplete).toBeUndefined();

      const markedSkills = loadSkillsWithValidation(fs);
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

      fs.writeFile(join(skillsDir, 'broken-skill.md'), invalidSkill);

      const tasks: Task[] = [
        {
          action: 'Run broken skill',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Broken Skill',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

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

      fs.writeFile(join(skillsDir, 'mismatched-skill.md'), mismatchedSkill);

      const tasks: Task[] = [
        {
          action: 'Run mismatched skill',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Mismatched Skill',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

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

      fs.writeFile(join(skillsDir, 'deploy-env.md'), deploySkill);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'migrate.md'), migrationSkill);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'setup.md'), labeledSkill);

      const skills = loadSkillDefinitions(fs);
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

      fs.writeFile(join(skillsDir, 'connect-to-database.md'), baseSkill);
      fs.writeFile(join(skillsDir, 'run-query.md'), wrapperSkill);

      const tasks: Task[] = [
        {
          action: 'Run database query',
          type: TaskType.Execute,
          step: 1,
          config: ['db.host', 'db.port'],
          params: {
            skill: 'Run Query',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      // Should detect missing config from nested reference
      expect(result.missingConfig.length).toBeGreaterThan(0);
      const paths = result.missingConfig.map((c) => c.path);
      expect(paths).toContain('db.host');
      expect(paths).toContain('db.port');
    });
  });

  describe('Skill name normalization and lookup', () => {
    it('handles skills with numbers in names', () => {
      const buildSkill = `### Name
Build Project 2

### Description
Build the second version of the project

### Steps
- Compile code

### Execution
- npm run build:v2
`;

      fs.writeFile(join(skillsDir, 'build-project-2.md'), buildSkill);

      const tasks: Task[] = [
        {
          action: 'Build version 2',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Build Project 2',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
      expect(result.missingConfig).toHaveLength(0);
    });

    it('handles skills with special characters in references', () => {
      const setupSkill = `### Name
Setup Node.js Environment

### Description
Install and configure Node.js development environment

### Steps
- Install Node

### Execution
- brew install node
`;

      const deploySkill = `### Name
Deploy Web App

### Description
Deploy the web application after setup

### Steps
- Setup environment
- Deploy app

### Execution
- [ Setup Node.js Environment ]
- npm run deploy
`;

      fs.writeFile(join(skillsDir, 'setup-nodejs-environment.md'), setupSkill);
      fs.writeFile(join(skillsDir, 'deploy-web-app.md'), deploySkill);

      const tasks: Task[] = [
        {
          action: 'Deploy application',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Deploy Web App',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
      expect(result.missingConfig).toHaveLength(0);
    });

    it('handles skills without explicit Name section', () => {
      const simpleSkill = `### Description
A skill that relies on filename for its name

### Steps
- Execute command

### Execution
- echo "running"
`;

      fs.writeFile(join(skillsDir, 'auto-named.md'), simpleSkill);

      const skills = loadSkillDefinitions(fs);

      expect(skills).toHaveLength(1);
      expect(skills[0].key).toBe('auto-named');
      expect(skills[0].name).toBe('Auto Named'); // Derived from filename
    });

    it('matches skill references case-insensitively via kebab-case', () => {
      const baseSkill = `### Name
Run Tests

### Description
Execute test suite

### Steps
- Run tests

### Execution
- npm test
`;

      const wrapperSkill = `### Name
CI Pipeline

### Description
Run full CI pipeline

### Steps
- Run tests
- Build

### Execution
- [ Run Tests ]
- npm run build
`;

      fs.writeFile(join(skillsDir, 'run-tests.md'), baseSkill);
      fs.writeFile(join(skillsDir, 'ci-pipeline.md'), wrapperSkill);

      const tasks: Task[] = [
        {
          action: 'Run CI',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'CI Pipeline',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe('Step-based execution', () => {
    it('validates tasks include step field for skill execution', () => {
      const buildSkill = `### Name
Build Application

### Description
Build application with multiple steps

### Steps
- Install dependencies
- Run tests
- Compile code

### Execution
- npm install
- npm test
- npm run build
`;

      fs.writeFile(join(skillsDir, 'build-app.md'), buildSkill);

      const tasks: Task[] = [
        {
          action: 'Install dependencies',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Build Application',
          },
        },
        {
          action: 'Run tests',
          type: TaskType.Execute,
          step: 2,
          params: {
            skill: 'Build Application',
          },
        },
        {
          action: 'Compile code',
          type: TaskType.Execute,
          step: 3,
          params: {
            skill: 'Build Application',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
      expect(result.missingConfig).toHaveLength(0);
    });

    it('handles non-consecutive step numbers when steps are skipped', () => {
      const publishSkill = `### Name
Publish Package

### Description
Version bumping only required for new releases. Republishing existing version skips this step.

### Steps
- Run tests
- Build package
- Bump version
- Publish to registry

### Execution
- npm run test
- npm run build
- npm version patch
- npm publish
`;

      fs.writeFile(join(skillsDir, 'publish-package.md'), publishSkill);

      // User requested "republish", so step 3 (version bump) is skipped
      const tasks: Task[] = [
        {
          action: 'Run tests',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Publish Package',
          },
        },
        {
          action: 'Build package',
          type: TaskType.Execute,
          step: 2,
          params: {
            skill: 'Publish Package',
          },
        },
        {
          action: 'Publish to registry',
          type: TaskType.Execute,
          step: 4, // Step 3 was skipped
          params: {
            skill: 'Publish Package',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
      expect(result.missingConfig).toHaveLength(0);
    });

    it('handles step field with skill references', () => {
      const navigateSkill = `### Name
Navigate To Repository

### Description
Change to repository directory

### Config
repo:
  path: string

### Steps
- Navigate to repo

### Execution
- cd {repo.path}
`;

      const buildSkill = `### Name
Build With Navigation

### Description
Navigate and build

### Steps
- Navigate to repository
- Compile code

### Execution
- [ Navigate To Repository ]
- make build
`;

      fs.writeFile(join(skillsDir, 'navigate-to-repo.md'), navigateSkill);
      fs.writeFile(join(skillsDir, 'build-with-nav.md'), buildSkill);

      const tasks: Task[] = [
        {
          action: 'Navigate to repository',
          type: TaskType.Execute,
          step: 1,
          config: ['repo.path'],
          params: {
            skill: 'Build With Navigation',
          },
        },
        {
          action: 'Compile code',
          type: TaskType.Execute,
          step: 2,
          params: {
            skill: 'Build With Navigation',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
      expect(result.missingConfig.length).toBe(1);
      expect(result.missingConfig[0].path).toBe('repo.path');
    });

    it('handles single-step skill with step: 1', () => {
      const simpleSkill = `### Name
Simple Task

### Description
Execute a single command

### Steps
- Run command

### Execution
- echo "hello world"
`;

      fs.writeFile(join(skillsDir, 'simple-task.md'), simpleSkill);

      const tasks: Task[] = [
        {
          action: 'Run command',
          type: TaskType.Execute,
          step: 1,
          params: {
            skill: 'Simple Task',
          },
        },
      ];

      const result = validateExecuteTasks(tasks, fs);

      expect(result.validationErrors).toHaveLength(0);
      expect(result.missingConfig).toHaveLength(0);
    });
  });

  describe('Skills directory management', () => {
    it('returns correct skills directory path', () => {
      const dir = getSkillsDirectory();
      expect(dir).toBe(join(homedir(), '.pls', 'skills'));
    });

    it('handles missing skills directory gracefully', () => {
      // Create a fresh MemoryFileSystem without the skills directory
      const emptyFs = new MemoryFileSystem();

      const skills = loadSkillDefinitions(emptyFs);
      expect(skills).toEqual([]);
    });

    it('handles empty skills directory', () => {
      // Skills directory exists but contains no .md files
      // (it's already empty from beforeEach, so just verify)
      const skills = loadSkillDefinitions(fs);
      expect(skills).toEqual([]);

      // Verify the directory itself exists
      expect(fs.exists(skillsDir)).toBe(true);
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

      fs.writeFile(join(skillsDir, 'valid.md'), validSkill);
      fs.writeFile(join(skillsDir, 'incomplete.md'), incompleteSkill);
      fs.writeFile(join(skillsDir, 'invalid.md'), invalidSkill);

      const skills = loadSkillDefinitions(fs);
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
