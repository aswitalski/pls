import { homedir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  conflictsWithBuiltIn,
  expandSkillReferences,
  formatSkillsForPrompt,
  getReferencedSkills,
  getSkillsDirectory,
  isSkillReference,
  isValidSkillFilename,
  loadSkills,
  parseSkillReference,
  validateNoCycles,
} from '../../src/services/skills.js';
import { MemoryFileSystem } from '../../src/services/filesystem.js';
import { displayNameToKey } from '../../src/services/parser.js';
import { SkillDefinition } from '../../src/types/skills.js';

/**
 * Helper to create skill lookup function for tests
 * Converts display name to kebab-case key for matching
 */
function createTestLookup(
  skills: SkillDefinition[]
): (name: string) => SkillDefinition | null {
  return (name: string) => {
    const key = displayNameToKey(name);
    return skills.find((s) => s.key === key) || null;
  };
}

describe('Skills service', () => {
  let fs: MemoryFileSystem;
  let skillsDir: string;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    // Create .pls/skills directory structure in memory
    const plsDir = join(homedir(), '.pls');
    skillsDir = join(plsDir, 'skills');
    fs.createDirectory(skillsDir, { recursive: true });
  });

  describe('Getting skills directory', () => {
    it('returns path to .pls/skills in home directory', () => {
      const skillsDir = getSkillsDirectory();
      expect(skillsDir).toContain('.pls');
      expect(skillsDir).toContain('skills');
    });
  });

  describe('Validating skill filenames', () => {
    it('accepts valid kebab-case filenames', () => {
      expect(isValidSkillFilename('deploy-app.md')).toBe(true);
      expect(isValidSkillFilename('build-project.md')).toBe(true);
      expect(isValidSkillFilename('run-tests.md')).toBe(true);
      expect(isValidSkillFilename('simple.md')).toBe(true);
    });

    it('accepts filenames with numbers', () => {
      expect(isValidSkillFilename('build-v2.md')).toBe(true);
      expect(isValidSkillFilename('project-2.md')).toBe(true);
      expect(isValidSkillFilename('deploy-app-3.md')).toBe(true);
    });

    it('accepts uppercase .MD extension', () => {
      expect(isValidSkillFilename('deploy-app.MD')).toBe(true);
      expect(isValidSkillFilename('build.MD')).toBe(true);
    });

    it('rejects filenames with underscores', () => {
      expect(isValidSkillFilename('deploy_app.md')).toBe(false);
      expect(isValidSkillFilename('build_project.md')).toBe(false);
    });

    it('rejects filenames with spaces', () => {
      expect(isValidSkillFilename('deploy app.md')).toBe(false);
      expect(isValidSkillFilename('build project.md')).toBe(false);
    });

    it('rejects camelCase filenames', () => {
      expect(isValidSkillFilename('deployApp.md')).toBe(false);
      expect(isValidSkillFilename('buildProject.md')).toBe(false);
    });

    it('rejects PascalCase filenames', () => {
      expect(isValidSkillFilename('DeployApp.md')).toBe(false);
      expect(isValidSkillFilename('BuildProject.md')).toBe(false);
    });

    it('rejects uppercase filenames', () => {
      expect(isValidSkillFilename('DEPLOY.md')).toBe(false);
      expect(isValidSkillFilename('BUILD-APP.md')).toBe(false);
    });

    it('rejects filenames starting with hyphen', () => {
      expect(isValidSkillFilename('-deploy.md')).toBe(false);
      expect(isValidSkillFilename('-build-app.md')).toBe(false);
    });

    it('rejects filenames ending with hyphen', () => {
      expect(isValidSkillFilename('deploy-.md')).toBe(false);
      expect(isValidSkillFilename('build-app-.md')).toBe(false);
    });

    it('rejects filenames starting with number', () => {
      expect(isValidSkillFilename('2deploy.md')).toBe(false);
      expect(isValidSkillFilename('123-build.md')).toBe(false);
    });

    it('rejects non-markdown extensions', () => {
      expect(isValidSkillFilename('deploy-app.txt')).toBe(false);
      expect(isValidSkillFilename('build-project.yaml')).toBe(false);
      expect(isValidSkillFilename('run-tests.json')).toBe(false);
    });

    it('rejects filenames with special characters', () => {
      expect(isValidSkillFilename('deploy@app.md')).toBe(false);
      expect(isValidSkillFilename('build#project.md')).toBe(false);
      expect(isValidSkillFilename('run$tests.md')).toBe(false);
    });

    it('rejects filenames with consecutive hyphens', () => {
      expect(isValidSkillFilename('deploy--app.md')).toBe(false);
      expect(isValidSkillFilename('build---project.md')).toBe(false);
    });
  });

  describe('Checking for built-in skill conflicts', () => {
    it('detects conflicts with system skills', () => {
      expect(conflictsWithBuiltIn('schedule')).toBe(true);
      expect(conflictsWithBuiltIn('execute')).toBe(true);
      expect(conflictsWithBuiltIn('answer')).toBe(true);
      expect(conflictsWithBuiltIn('configure')).toBe(true);
      expect(conflictsWithBuiltIn('validate')).toBe(true);
      expect(conflictsWithBuiltIn('introspect')).toBe(true);
    });

    it('allows non-conflicting skill names', () => {
      expect(conflictsWithBuiltIn('deploy')).toBe(false);
      expect(conflictsWithBuiltIn('build')).toBe(false);
      expect(conflictsWithBuiltIn('test')).toBe(false);
      expect(conflictsWithBuiltIn('my-skill')).toBe(false);
    });

    it('is case-sensitive for built-in names', () => {
      expect(conflictsWithBuiltIn('Schedule')).toBe(false);
      expect(conflictsWithBuiltIn('EXECUTE')).toBe(false);
      expect(conflictsWithBuiltIn('Answer')).toBe(false);
    });
  });

  describe('Loading skills', () => {
    it('returns empty array when skills directory does not exist', () => {
      // Create a fresh MemoryFileSystem without the skills directory
      const emptyFs = new MemoryFileSystem();

      const skills = loadSkills(emptyFs);
      expect(skills).toEqual([]);
    });

    it('returns empty array when skills directory is empty', () => {
      const skills = loadSkills(fs);
      expect(skills).toEqual([]);
    });

    it('loads single skill file', () => {
      const skillContent = `### Name
Build Opera

### Description
Run Opera Desktop browser build

### Steps
Navigate to the project directory, run the project generation script, run the compilation`;

      fs.writeFile(join(skillsDir, 'opera.md'), skillContent);

      const skills = loadSkills(fs);
      expect(skills).toHaveLength(1);
      expect(skills[0]).toEqual({ key: 'opera', content: skillContent });
    });

    it('loads multiple skill files', () => {
      const skill1 = 'Skill 1 content';
      const skill2 = 'Skill 2 content';

      fs.writeFile(join(skillsDir, 'skill1.md'), skill1);
      fs.writeFile(join(skillsDir, 'skill2.md'), skill2);

      const skills = loadSkills(fs);
      expect(skills).toHaveLength(2);
      expect(skills).toContainEqual({ key: 'skill1', content: skill1 });
      expect(skills).toContainEqual({ key: 'skill2', content: skill2 });
    });

    it('ignores non-markdown files', () => {
      fs.writeFile(join(skillsDir, 'skill.md'), 'Skill content');
      fs.writeFile(join(skillsDir, 'readme.txt'), 'Not a skill');
      fs.writeFile(join(skillsDir, 'data.json'), '{}');

      const skills = loadSkills(fs);
      expect(skills).toHaveLength(1);
      expect(skills[0]).toEqual({ key: 'skill', content: 'Skill content' });
    });

    it('handles both .md and .MD extensions', () => {
      fs.writeFile(join(skillsDir, 'skill1.md'), 'Lowercase');
      fs.writeFile(join(skillsDir, 'skill2.MD'), 'Uppercase');

      const skills = loadSkills(fs);
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

describe('Parsing skill references', () => {
  it('parses valid skill reference with spaces', () => {
    expect(parseSkillReference('[ Navigate To Product ]')).toBe(
      'Navigate To Product'
    );
    expect(parseSkillReference('[ Simple ]')).toBe('Simple');
    expect(parseSkillReference('[  Build Project  ]')).toBe('Build Project');
  });

  it('returns null for references without spaces', () => {
    expect(parseSkillReference('[NavigateToProduct]')).toBeNull();
    expect(parseSkillReference('[navigate-to-product]')).toBeNull();
  });

  it('returns null for non-reference', () => {
    expect(parseSkillReference('regular command')).toBeNull();
    expect(parseSkillReference('command [ not at start ]')).toBeNull();
    expect(parseSkillReference('[ incomplete')).toBeNull();
    expect(parseSkillReference('incomplete ]')).toBeNull();
  });
});

describe('Checking if line is skill reference', () => {
  it('returns true for valid reference with spaces', () => {
    expect(isSkillReference('[ Navigate To Product ]')).toBe(true);
    expect(isSkillReference('  [ Navigate To Product ]  ')).toBe(true);
    expect(isSkillReference('[  Build  ]')).toBe(true);
  });

  it('returns false for references without spaces', () => {
    expect(isSkillReference('[navigate-to-product]')).toBe(false);
    expect(isSkillReference('[NavigateToProduct]')).toBe(false);
  });

  it('returns false for non-reference', () => {
    expect(isSkillReference('regular command')).toBe(false);
    expect(isSkillReference('command [ not at start ]')).toBe(false);
  });
});

describe('Expanding skill references', () => {
  const skills: SkillDefinition[] = [
    {
      key: 'navigate-to-product',
      name: 'Navigate To Product',
      description: 'Navigation skill',
      steps: ['Change to directory'],
      execution: ['cd {product.VARIANT.path}'],
      isValid: true,
    },
    {
      key: 'build-product',
      name: 'Build Product',
      description: 'Build skill',
      steps: ['Navigate', 'Compile'],
      execution: ['[ Navigate To Product ]', 'make build'],
      isValid: true,
    },
    {
      key: 'deploy-product',
      name: 'Deploy Product',
      description: 'Deploy skill',
      steps: ['Build', 'Upload'],
      execution: ['[ Build Product ]', 'scp dist/* server:/app'],
      isValid: true,
    },
  ];

  const lookup = createTestLookup(skills);

  it('keeps non-reference lines as-is', () => {
    const execution = ['regular command', 'another command'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(execution);
  });

  it('expands single skill reference', () => {
    const execution = ['[ Navigate To Product ]', 'make build'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(['cd {product.VARIANT.path}', 'make build']);
  });

  it('expands nested skill references', () => {
    const execution = ['[ Build Product ]'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(['cd {product.VARIANT.path}', 'make build']);
  });

  it('expands deeply nested skill references', () => {
    const execution = ['[ Deploy Product ]'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual([
      'cd {product.VARIANT.path}',
      'make build',
      'scp dist/* server:/app',
    ]);
  });

  it('throws error for unknown skill reference', () => {
    const execution = ['[ Unknown Skill ]', 'other command'];

    expect(() => expandSkillReferences(execution, lookup)).toThrow(
      /unknown skill/i
    );
  });

  it('throws error for circular reference', () => {
    const circularSkills: SkillDefinition[] = [
      {
        key: 'a',
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[ B ]'],
        isValid: true,
      },
      {
        key: 'b',
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['[ C ]'],
        isValid: true,
      },
      {
        key: 'c',
        name: 'C',
        description: 'Skill C',
        steps: ['Step'],
        execution: ['[ A ]'],
        isValid: true,
      },
    ];

    const circularLookup = createTestLookup(circularSkills);

    expect(() => {
      expandSkillReferences(['[ A ]'], circularLookup);
    }).toThrow('Circular skill reference detected');
  });

  it('throws error for direct self-reference', () => {
    const selfRefSkills: SkillDefinition[] = [
      {
        key: 'loop',
        name: 'Loop',
        description: 'Self-referencing skill',
        steps: ['Step'],
        execution: ['[ Loop ]'],
        isValid: true,
      },
    ];

    const selfRefLookup = createTestLookup(selfRefSkills);

    expect(() => {
      expandSkillReferences(['[ Loop ]'], selfRefLookup);
    }).toThrow('Circular skill reference detected');
  });
});

describe('Getting referenced skills', () => {
  const skills: SkillDefinition[] = [
    {
      key: 'a',
      name: 'A',
      description: 'Skill A',
      steps: ['Step'],
      execution: ['[ B ]', '[ C ]'],
      isValid: true,
    },
    {
      key: 'b',
      name: 'B',
      description: 'Skill B',
      steps: ['Step'],
      execution: ['[ D ]'],
      isValid: true,
    },
    {
      key: 'c',
      name: 'C',
      description: 'Skill C',
      steps: ['Step'],
      execution: ['command'],
      isValid: true,
    },
    {
      key: 'd',
      name: 'D',
      description: 'Skill D',
      steps: ['Step'],
      execution: ['command'],
      isValid: true,
    },
  ];

  const lookup = createTestLookup(skills);

  it('returns empty set for execution without references', () => {
    const referenced = getReferencedSkills(['command1', 'command2'], lookup);

    expect(referenced.size).toBe(0);
  });

  it('returns direct references', () => {
    const referenced = getReferencedSkills(['[ B ]', '[ C ]'], lookup);

    expect(referenced.has('B')).toBe(true);
    expect(referenced.has('C')).toBe(true);
    expect(referenced.has('D')).toBe(true); // B references D
    expect(referenced.size).toBe(3);
  });

  it('returns nested references', () => {
    const referenced = getReferencedSkills(['[ A ]'], lookup);

    expect(referenced.has('A')).toBe(true);
    expect(referenced.has('B')).toBe(true);
    expect(referenced.has('C')).toBe(true);
    expect(referenced.has('D')).toBe(true);
    expect(referenced.size).toBe(4);
  });

  it('handles unknown skill references', () => {
    const referenced = getReferencedSkills(['[ Unknown ]', '[ B ]'], lookup);

    expect(referenced.has('Unknown')).toBe(true);
    expect(referenced.has('B')).toBe(true);
    expect(referenced.has('D')).toBe(true);
  });
});

describe('Validating no cycles', () => {
  it('returns true for valid skills', () => {
    const skills: SkillDefinition[] = [
      {
        key: 'a',
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[ B ]'],
        isValid: true,
      },
      {
        key: 'b',
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['command'],
        isValid: true,
      },
    ];

    const lookup = createTestLookup(skills);

    expect(validateNoCycles(['[ A ]'], lookup)).toBe(true);
  });

  it('returns false for circular reference', () => {
    const skills: SkillDefinition[] = [
      {
        key: 'a',
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[ B ]'],
        isValid: true,
      },
      {
        key: 'b',
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['[ A ]'],
        isValid: true,
      },
    ];

    const lookup = createTestLookup(skills);

    expect(validateNoCycles(['[ A ]'], lookup)).toBe(false);
  });

  it('returns true for non-circular duplicate references', () => {
    const skills: SkillDefinition[] = [
      {
        key: 'a',
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[ C ]'],
        isValid: true,
      },
      {
        key: 'b',
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['[ C ]'],
        isValid: true,
      },
      {
        key: 'c',
        name: 'C',
        description: 'Skill C',
        steps: ['Step'],
        execution: ['command'],
        isValid: true,
      },
    ];

    const lookup = createTestLookup(skills);

    expect(validateNoCycles(['[ A ]', '[ B ]'], lookup)).toBe(true);
  });
});
