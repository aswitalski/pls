import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  expandSkillReferences,
  formatSkillsForPrompt,
  getReferencedSkills,
  getSkillsDirectory,
  isSkillReference,
  loadSkills,
  parseSkillReference,
  validateNoCycles,
} from '../../src/services/skills.js';
import { displayNameToKey } from '../../src/services/parser.js';
import { SkillDefinition } from '../../src/types/skills.js';

import { safeRemoveDirectory } from '../test-utils.js';

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
