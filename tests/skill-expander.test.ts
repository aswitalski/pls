import { describe, expect, it } from 'vitest';

import {
  expandSkillReferences,
  getReferencedSkills,
  isSkillReference,
  parseSkillReference,
  validateNoCycles,
} from '../src/services/skill-expander.js';
import { SkillDefinition } from '../src/types/skills.js';

describe('Parsing skill references', () => {
  it('parses valid skill reference', () => {
    expect(parseSkillReference('[Navigate To Product]')).toBe(
      'Navigate To Product'
    );
    expect(parseSkillReference('[Simple]')).toBe('Simple');
  });

  it('returns null for non-reference', () => {
    expect(parseSkillReference('regular command')).toBeNull();
    expect(parseSkillReference('command [not at start]')).toBeNull();
    expect(parseSkillReference('[incomplete')).toBeNull();
    expect(parseSkillReference('incomplete]')).toBeNull();
  });

  it('trims whitespace from skill name', () => {
    expect(parseSkillReference('[  Skill Name  ]')).toBe('Skill Name');
  });
});

describe('Checking if line is skill reference', () => {
  it('returns true for valid reference', () => {
    expect(isSkillReference('[Navigate To Product]')).toBe(true);
    expect(isSkillReference('  [Navigate To Product]  ')).toBe(true);
  });

  it('returns false for non-reference', () => {
    expect(isSkillReference('regular command')).toBe(false);
    expect(isSkillReference('command [not at start]')).toBe(false);
  });
});

describe('Expanding skill references', () => {
  const skills: Record<string, SkillDefinition> = {
    'Navigate To Product': {
      name: 'Navigate To Product',
      description: 'Navigation skill',
      steps: ['Change to directory'],
      execution: ['cd {product.VARIANT.path}'],
    },
    'Build Product': {
      name: 'Build Product',
      description: 'Build skill',
      steps: ['Navigate', 'Compile'],
      execution: ['[Navigate To Product]', 'make build'],
    },
    'Deploy Product': {
      name: 'Deploy Product',
      description: 'Deploy skill',
      steps: ['Build', 'Upload'],
      execution: ['[Build Product]', 'scp dist/* server:/app'],
    },
    'No Execution': {
      name: 'No Execution',
      description: 'Skill without execution',
      steps: ['Some step'],
    },
  };

  const lookup = (name: string) => skills[name] ?? null;

  it('keeps non-reference lines as-is', () => {
    const execution = ['regular command', 'another command'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(execution);
  });

  it('expands single skill reference', () => {
    const execution = ['[Navigate To Product]', 'make build'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(['cd {product.VARIANT.path}', 'make build']);
  });

  it('expands nested skill references', () => {
    const execution = ['[Build Product]'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(['cd {product.VARIANT.path}', 'make build']);
  });

  it('expands deeply nested skill references', () => {
    const execution = ['[Deploy Product]'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual([
      'cd {product.VARIANT.path}',
      'make build',
      'scp dist/* server:/app',
    ]);
  });

  it('keeps unknown skill reference as-is', () => {
    const execution = ['[Unknown Skill]', 'other command'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(['[Unknown Skill]', 'other command']);
  });

  it('skips skill without execution', () => {
    const execution = ['[No Execution]', 'other command'];
    const expanded = expandSkillReferences(execution, lookup);

    expect(expanded).toEqual(['other command']);
  });

  it('throws error for circular reference', () => {
    const circularSkills: Record<string, SkillDefinition> = {
      A: {
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[B]'],
      },
      B: {
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['[C]'],
      },
      C: {
        name: 'C',
        description: 'Skill C',
        steps: ['Step'],
        execution: ['[A]'],
      },
    };

    const circularLookup = (name: string) => circularSkills[name] ?? null;

    expect(() => {
      expandSkillReferences(['[A]'], circularLookup);
    }).toThrow('Circular skill reference detected');
  });

  it('throws error for direct self-reference', () => {
    const selfRefSkills: Record<string, SkillDefinition> = {
      Loop: {
        name: 'Loop',
        description: 'Self-referencing skill',
        steps: ['Step'],
        execution: ['[Loop]'],
      },
    };

    const selfRefLookup = (name: string) => selfRefSkills[name] ?? null;

    expect(() => {
      expandSkillReferences(['[Loop]'], selfRefLookup);
    }).toThrow('Circular skill reference detected');
  });
});

describe('Getting referenced skills', () => {
  const skills: Record<string, SkillDefinition> = {
    A: {
      name: 'A',
      description: 'Skill A',
      steps: ['Step'],
      execution: ['[B]', '[C]'],
    },
    B: {
      name: 'B',
      description: 'Skill B',
      steps: ['Step'],
      execution: ['[D]'],
    },
    C: {
      name: 'C',
      description: 'Skill C',
      steps: ['Step'],
      execution: ['command'],
    },
    D: {
      name: 'D',
      description: 'Skill D',
      steps: ['Step'],
      execution: ['command'],
    },
  };

  const lookup = (name: string) => skills[name] ?? null;

  it('returns empty set for execution without references', () => {
    const referenced = getReferencedSkills(['command1', 'command2'], lookup);

    expect(referenced.size).toBe(0);
  });

  it('returns direct references', () => {
    const referenced = getReferencedSkills(['[B]', '[C]'], lookup);

    expect(referenced.has('B')).toBe(true);
    expect(referenced.has('C')).toBe(true);
    expect(referenced.has('D')).toBe(true); // B references D
    expect(referenced.size).toBe(3);
  });

  it('returns nested references', () => {
    const referenced = getReferencedSkills(['[A]'], lookup);

    expect(referenced.has('A')).toBe(true);
    expect(referenced.has('B')).toBe(true);
    expect(referenced.has('C')).toBe(true);
    expect(referenced.has('D')).toBe(true);
    expect(referenced.size).toBe(4);
  });

  it('handles unknown skill references', () => {
    const referenced = getReferencedSkills(['[Unknown]', '[B]'], lookup);

    expect(referenced.has('Unknown')).toBe(true);
    expect(referenced.has('B')).toBe(true);
    expect(referenced.has('D')).toBe(true);
  });
});

describe('Validating no cycles', () => {
  it('returns true for valid skills', () => {
    const skills: Record<string, SkillDefinition> = {
      A: {
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[B]'],
      },
      B: {
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['command'],
      },
    };

    const lookup = (name: string) => skills[name] ?? null;

    expect(validateNoCycles(['[A]'], lookup)).toBe(true);
  });

  it('returns false for circular reference', () => {
    const skills: Record<string, SkillDefinition> = {
      A: {
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[B]'],
      },
      B: {
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['[A]'],
      },
    };

    const lookup = (name: string) => skills[name] ?? null;

    expect(validateNoCycles(['[A]'], lookup)).toBe(false);
  });

  it('returns true for non-circular duplicate references', () => {
    const skills: Record<string, SkillDefinition> = {
      A: {
        name: 'A',
        description: 'Skill A',
        steps: ['Step'],
        execution: ['[C]'],
      },
      B: {
        name: 'B',
        description: 'Skill B',
        steps: ['Step'],
        execution: ['[C]'],
      },
      C: {
        name: 'C',
        description: 'Skill C',
        steps: ['Step'],
        execution: ['command'],
      },
    };

    const lookup = (name: string) => skills[name] ?? null;

    expect(validateNoCycles(['[A]', '[B]'], lookup)).toBe(true);
  });
});
