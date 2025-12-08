import { describe, expect, it } from 'vitest';

import {
  generateConfigPaths,
  getConfigType,
  parseSkillMarkdown,
} from '../src/services/skill-parser.js';

describe('Parsing skill markdown', () => {
  it('parses minimal valid skill', () => {
    const content = `
### Name
Test Skill

### Description
A test skill for validation

### Steps
- First step
- Second step

### Execution
- echo "first"
- echo "second"
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(true);
    expect(skill.name).toBe('Test Skill');
    expect(skill.description).toBe('A test skill for validation');
    expect(skill.steps).toEqual(['First step', 'Second step']);
    expect(skill.execution).toEqual(['echo "first"', 'echo "second"']);
    expect(skill.aliases).toBeUndefined();
    expect(skill.config).toBeUndefined();
  });

  it('parses skill with all sections', () => {
    const content = `
### Name
Complete Skill

### Description
A complete skill with all sections

### Aliases
- do something
- perform action

### Config
product:
  alpha:
    path: string
    enabled: boolean
  beta:
    path: string

### Steps
- Navigate to product
- Execute operation

### Execution
- [Navigate To Product]
- operation {product.VARIANT.path}
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(true);
    expect(skill.name).toBe('Complete Skill');
    expect(skill.description).toBe('A complete skill with all sections');
    expect(skill.aliases).toEqual(['do something', 'perform action']);
    expect(skill.config).toEqual({
      product: {
        alpha: {
          path: 'string',
          enabled: 'boolean',
        },
        beta: {
          path: 'string',
        },
      },
    });
    expect(skill.steps).toEqual(['Navigate to product', 'Execute operation']);
    expect(skill.execution).toEqual([
      '[Navigate To Product]',
      'operation {product.VARIANT.path}',
    ]);
  });

  it('returns invalid skill for skill missing name', () => {
    const content = `
### Description
Missing name section

### Steps
- Some step
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(false);
    expect(skill.isIncomplete).toBe(true);
    expect(skill.validationError).toContain('missing a Name section');
  });

  it('returns invalid skill for skill missing description', () => {
    const content = `
### Name
Test Skill

### Steps
- Some step
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(false);
    expect(skill.isIncomplete).toBe(true);
    expect(skill.validationError).toContain('missing a Description section');
  });

  it('returns invalid skill for skill missing steps', () => {
    const content = `
### Name
Test Skill

### Description
Missing steps
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(false);
    expect(skill.isIncomplete).toBe(true);
    expect(skill.validationError).toContain('missing a Steps section');
  });

  it('returns invalid skill for skill missing execution', () => {
    const content = `
### Name
Test Skill

### Description
Missing execution

### Steps
- Some step
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(false);
    expect(skill.isIncomplete).toBe(true);
    expect(skill.validationError).toContain('missing an Execution section');
  });

  it('returns invalid skill when execution and steps count mismatch', () => {
    const content = `
### Name
Test Skill

### Description
Mismatched counts

### Steps
- First step
- Second step

### Execution
- Only one execution line
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(false);
    expect(skill.isIncomplete).toBe(true);
    expect(skill.validationError).toContain('2 steps but 1 execution');
  });

  it('parses execution with labeled commands', () => {
    const content = `
### Name
Test Skill

### Description
With labeled commands

### Steps
- Run installation
- Run build

### Execution
- Run: npm install
- Run: npm run build
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.execution).toEqual(['Run: npm install', 'Run: npm run build']);
  });

  it('parses skill references in execution', () => {
    const content = `
### Name
Test Skill

### Description
With skill reference

### Steps
- Navigate first
- Do something

### Execution
- [Navigate To Product]
- operation --flag
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.execution).toEqual([
      '[Navigate To Product]',
      'operation --flag',
    ]);
  });

  it('marks skill as incomplete when description is very short', () => {
    const content = `
### Name
Test Skill

### Description
Brief

### Steps
- Some step

### Execution
- echo "test"
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(true);
    expect(skill.isIncomplete).toBe(true);
  });

  it('marks skill as incomplete when description is minimal', () => {
    const content = `
### Name
Test Skill

### Description
TODO

### Steps
- Some step

### Execution
- echo "test"
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(true);
    expect(skill.isIncomplete).toBe(true);
  });

  it('marks skill as complete when description is adequate', () => {
    const content = `
### Name
Test Skill

### Description
This is a detailed description of what the skill does

### Steps
- Some step

### Execution
- echo "test"
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill.isValid).toBe(true);
    expect(skill.isIncomplete).toBeUndefined();
  });

  it('uses 20 characters as incomplete threshold', () => {
    // Test with exactly 19 characters (should be incomplete)
    const incomplete19 = `
### Name
Test Skill

### Description
Nineteen characters

### Steps
- Some step

### Execution
- echo "test"
`;

    const skill19 = parseSkillMarkdown(incomplete19);
    expect(skill19.isValid).toBe(true);
    expect(skill19.isIncomplete).toBe(true);

    // Test with exactly 20 characters (should be complete)
    const complete20 = `
### Name
Test Skill

### Description
Twenty characters!!!

### Steps
- Some step

### Execution
- echo "test"
`;

    const skill20 = parseSkillMarkdown(complete20);
    expect(skill20.isValid).toBe(true);
    expect(skill20.isIncomplete).toBeUndefined();

    // Test with 21 characters (should be complete)
    const complete21 = `
### Name
Test Skill

### Description
Twenty-one characters

### Steps
- Some step

### Execution
- echo "test"
`;

    const skill21 = parseSkillMarkdown(complete21);
    expect(skill21.isValid).toBe(true);
    expect(skill21.isIncomplete).toBeUndefined();
  });
});

describe('Generating config paths', () => {
  it('generates paths for flat config', () => {
    const schema = {
      setting1: 'string' as const,
      setting2: 'boolean' as const,
    };

    const paths = generateConfigPaths(schema);

    expect(paths).toEqual(['setting1', 'setting2']);
  });

  it('generates paths for nested config', () => {
    const schema = {
      product: {
        alpha: {
          path: 'string' as const,
          enabled: 'boolean' as const,
        },
        beta: {
          path: 'string' as const,
        },
      },
    };

    const paths = generateConfigPaths(schema);

    expect(paths).toContain('product.alpha.path');
    expect(paths).toContain('product.alpha.enabled');
    expect(paths).toContain('product.beta.path');
    expect(paths.length).toBe(3);
  });

  it('generates paths for deeply nested config', () => {
    const schema = {
      app: {
        database: {
          primary: {
            host: 'string' as const,
            port: 'number' as const,
          },
        },
      },
    };

    const paths = generateConfigPaths(schema);

    expect(paths).toContain('app.database.primary.host');
    expect(paths).toContain('app.database.primary.port');
  });
});

describe('Getting config type', () => {
  const schema = {
    product: {
      alpha: {
        path: 'string' as const,
        enabled: 'boolean' as const,
        count: 'number' as const,
      },
    },
  };

  it('returns correct type for valid path', () => {
    expect(getConfigType(schema, 'product.alpha.path')).toBe('string');
    expect(getConfigType(schema, 'product.alpha.enabled')).toBe('boolean');
    expect(getConfigType(schema, 'product.alpha.count')).toBe('number');
  });

  it('returns undefined for non-existent path', () => {
    expect(getConfigType(schema, 'product.beta.path')).toBeUndefined();
    expect(getConfigType(schema, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for partial path', () => {
    expect(getConfigType(schema, 'product.alpha')).toBeUndefined();
    expect(getConfigType(schema, 'product')).toBeUndefined();
  });
});
