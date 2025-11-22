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
`;

    const skill = parseSkillMarkdown(content);

    expect(skill).toBeDefined();
    expect(skill?.name).toBe('Test Skill');
    expect(skill?.description).toBe('A test skill for validation');
    expect(skill?.steps).toEqual(['First step', 'Second step']);
    expect(skill?.aliases).toBeUndefined();
    expect(skill?.config).toBeUndefined();
    expect(skill?.execution).toBeUndefined();
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
    expect(skill?.name).toBe('Complete Skill');
    expect(skill?.description).toBe('A complete skill with all sections');
    expect(skill?.aliases).toEqual(['do something', 'perform action']);
    expect(skill?.config).toEqual({
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
    expect(skill?.steps).toEqual(['Navigate to product', 'Execute operation']);
    expect(skill?.execution).toEqual([
      '[Navigate To Product]',
      'operation {product.VARIANT.path}',
    ]);
  });

  it('returns null for skill missing name', () => {
    const content = `
### Description
Missing name section

### Steps
- Some step
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeNull();
  });

  it('returns null for skill missing description', () => {
    const content = `
### Name
Test Skill

### Steps
- Some step
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeNull();
  });

  it('returns null for skill missing steps', () => {
    const content = `
### Name
Test Skill

### Description
Missing steps
`;

    const skill = parseSkillMarkdown(content);
    expect(skill).toBeNull();
  });

  it('returns null when execution and steps count mismatch', () => {
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
    expect(skill).toBeNull();
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
    expect(skill?.execution).toEqual([
      'Run: npm install',
      'Run: npm run build',
    ]);
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
    expect(skill?.execution).toEqual([
      '[Navigate To Product]',
      'operation --flag',
    ]);
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
