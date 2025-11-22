import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateSkillConfig } from '../src/services/config-validator.js';
import { SkillDefinition } from '../src/types/skills.js';

import { safeRemoveDirectory } from './test-utils.js';

describe('Validating skill config', () => {
  const testDir = join(homedir(), '.pls-test-config-validator');
  const testConfigPath = join(testDir, '.plsrc');

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up
    safeRemoveDirectory(testDir);
  });

  const simpleSkill: SkillDefinition = {
    name: 'Simple Skill',
    description: 'A simple skill',
    steps: ['Do something'],
    execution: ['command {product.alpha.path}'],
    config: {
      product: {
        alpha: {
          path: 'string',
        },
      },
    },
  };

  const variantSkill: SkillDefinition = {
    name: 'Variant Skill',
    description: 'A skill with variants',
    steps: ['Do something'],
    execution: ['operation {product.VARIANT.path}'],
    config: {
      product: {
        alpha: {
          path: 'string',
        },
        beta: {
          path: 'string',
        },
      },
    },
  };

  const navigationSkill: SkillDefinition = {
    name: 'Navigate',
    description: 'Navigation skill',
    steps: ['Navigate'],
    execution: ['cd {product.VARIANT.path}'],
    config: {
      product: {
        alpha: {
          path: 'string',
        },
        beta: {
          path: 'string',
        },
      },
    },
  };

  const compositeSkill: SkillDefinition = {
    name: 'Composite Skill',
    description: 'Composite skill',
    steps: ['Navigate', 'Build'],
    execution: ['[Navigate]', 'make build'],
  };

  const noopLookup = () => null;

  it('validates skill with no execution', () => {
    const skill: SkillDefinition = {
      name: 'No Execution',
      description: 'Skill without execution',
      steps: ['Something'],
    };

    const result = validateSkillConfig(skill, {}, noopLookup);

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('detects missing config for simple skill', () => {
    const result = validateSkillConfig(simpleSkill, {}, noopLookup);

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].path).toBe('product.alpha.path');
    expect(result.missing[0].type).toBe('string');
  });

  it('validates when config exists', () => {
    // Write config file
    writeFileSync(
      testConfigPath,
      `product:
  alpha:
    path: /data/alpha
`,
      'utf-8'
    );

    // Temporarily override homedir for test
    const originalHomedir = process.env.HOME;
    process.env.HOME = testDir;

    try {
      const result = validateSkillConfig(simpleSkill, {}, noopLookup);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    } finally {
      process.env.HOME = originalHomedir;
    }
  });

  it('detects missing config for variant skill', () => {
    const result = validateSkillConfig(
      variantSkill,
      { product: 'alpha' },
      noopLookup
    );

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].path).toBe('product.alpha.path');
  });

  it('validates variant skill with config', () => {
    // Write config file
    writeFileSync(
      testConfigPath,
      `product:
  alpha:
    path: /data/alpha
`,
      'utf-8'
    );

    const originalHomedir = process.env.HOME;
    process.env.HOME = testDir;

    try {
      const result = validateSkillConfig(
        variantSkill,
        { product: 'alpha' },
        noopLookup
      );

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    } finally {
      process.env.HOME = originalHomedir;
    }
  });

  it('handles different variant selection', () => {
    const result = validateSkillConfig(
      variantSkill,
      { product: 'beta' },
      noopLookup
    );

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].path).toBe('product.beta.path');
  });

  it('validates composite skill with references', () => {
    const lookup = (name: string) =>
      name === 'Navigate' ? navigationSkill : null;

    const result = validateSkillConfig(
      compositeSkill,
      { product: 'alpha' },
      lookup
    );

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(1);
    expect(result.missing[0].path).toBe('product.alpha.path');
  });

  it('handles multiple placeholders in one command', () => {
    const multiPlaceholder: SkillDefinition = {
      name: 'Multi Placeholder',
      description: 'Multiple placeholders',
      steps: ['Do something'],
      execution: ['copy {source.path} {dest.path}'],
      config: {
        source: {
          path: 'string',
        },
        dest: {
          path: 'string',
        },
      },
    };

    const result = validateSkillConfig(multiPlaceholder, {}, noopLookup);

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(2);
    const paths = result.missing.map((m) => m.path);
    expect(paths).toContain('source.path');
    expect(paths).toContain('dest.path');
  });

  it('generates appropriate descriptions', () => {
    const result = validateSkillConfig(simpleSkill, {}, noopLookup);

    expect(result.missing[0].description).toBe('Product Alpha Path');
  });

  it('handles variant not specified', () => {
    // When variant map doesn't specify the variant, can't determine config path
    const result = validateSkillConfig(variantSkill, {}, noopLookup);

    // Should return valid because variant placeholder can't be resolved
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('handles boolean config type', () => {
    const boolSkill: SkillDefinition = {
      name: 'Boolean Skill',
      description: 'Skill with boolean',
      steps: ['Check enabled'],
      execution: ['check --enabled={product.alpha.enabled}'],
      config: {
        product: {
          alpha: {
            enabled: 'boolean',
          },
        },
      },
    };

    const result = validateSkillConfig(boolSkill, {}, noopLookup);

    expect(result.valid).toBe(false);
    expect(result.missing[0].type).toBe('boolean');
  });

  it('handles number config type', () => {
    const numberSkill: SkillDefinition = {
      name: 'Number Skill',
      description: 'Skill with number',
      steps: ['Process with count'],
      execution: ['process --count={product.alpha.count}'],
      config: {
        product: {
          alpha: {
            count: 'number',
          },
        },
      },
    };

    const result = validateSkillConfig(numberSkill, {}, noopLookup);

    expect(result.valid).toBe(false);
    expect(result.missing[0].type).toBe('number');
  });
});
