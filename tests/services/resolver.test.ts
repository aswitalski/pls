import { describe, expect, it } from 'vitest';

import {
  extractPlaceholders,
  getRequiredConfigPaths,
  hasPlaceholders,
  parsePlaceholder,
  pathToString,
  replacePlaceholders,
  resolveFromConfig,
  resolveVariant,
} from '../../src/services/resolver.js';

describe('Parsing placeholders', () => {
  it('parses strict placeholder', () => {
    const placeholder = parsePlaceholder('{product.alpha.path}');

    expect(placeholder).toBeDefined();
    expect(placeholder?.original).toBe('{product.alpha.path}');
    expect(placeholder?.path).toEqual(['product', 'alpha', 'path']);
    expect(placeholder?.hasVariant).toBe(false);
    expect(placeholder?.variantIndex).toBeUndefined();
  });

  it('parses variant placeholder with VARIANT keyword', () => {
    const placeholder = parsePlaceholder('{product.VARIANT.path}');

    expect(placeholder).toBeDefined();
    expect(placeholder?.original).toBe('{product.VARIANT.path}');
    expect(placeholder?.path).toEqual(['product', 'VARIANT', 'path']);
    expect(placeholder?.hasVariant).toBe(true);
    expect(placeholder?.variantIndex).toBe(1);
  });

  it('parses variant placeholder with TYPE keyword', () => {
    const placeholder = parsePlaceholder('{env.TYPE.config}');

    expect(placeholder).toBeDefined();
    expect(placeholder?.original).toBe('{env.TYPE.config}');
    expect(placeholder?.path).toEqual(['env', 'TYPE', 'config']);
    expect(placeholder?.hasVariant).toBe(true);
    expect(placeholder?.variantIndex).toBe(1);
  });

  it('parses variant placeholder with TARGET keyword', () => {
    const placeholder = parsePlaceholder('{project.TARGET.path}');

    expect(placeholder).toBeDefined();
    expect(placeholder?.original).toBe('{project.TARGET.path}');
    expect(placeholder?.path).toEqual(['project', 'TARGET', 'path']);
    expect(placeholder?.hasVariant).toBe(true);
    expect(placeholder?.variantIndex).toBe(1);
  });

  it('returns null for text without placeholder', () => {
    const placeholder = parsePlaceholder('no placeholder here');

    expect(placeholder).toBeNull();
  });

  it('parses first placeholder in text with multiple', () => {
    const placeholder = parsePlaceholder(
      'text {product.alpha.path} more {product.beta.path}'
    );

    expect(placeholder?.original).toBe('{product.alpha.path}');
  });
});

describe('Extracting all placeholders', () => {
  it('extracts multiple placeholders', () => {
    const placeholders = extractPlaceholders(
      'operation {product.alpha.path} --output {product.alpha.output}'
    );

    expect(placeholders).toHaveLength(2);
    expect(placeholders[0].original).toBe('{product.alpha.path}');
    expect(placeholders[1].original).toBe('{product.alpha.output}');
  });

  it('extracts variant and strict placeholders', () => {
    const placeholders = extractPlaceholders(
      'run {product.VARIANT.command} in {product.alpha.path}'
    );

    expect(placeholders).toHaveLength(2);
    expect(placeholders[0].hasVariant).toBe(true);
    expect(placeholders[1].hasVariant).toBe(false);
  });

  it('returns empty array for text without placeholders', () => {
    const placeholders = extractPlaceholders('no placeholders here');

    expect(placeholders).toEqual([]);
  });
});

describe('Resolving variant', () => {
  it('replaces VARIANT with variant name', () => {
    const path = ['product', 'VARIANT', 'path'];
    const resolved = resolveVariant(path, 'alpha');

    expect(resolved).toEqual(['product', 'alpha', 'path']);
  });

  it('replaces TYPE with variant name', () => {
    const path = ['env', 'TYPE', 'config'];
    const resolved = resolveVariant(path, 'staging');

    expect(resolved).toEqual(['env', 'staging', 'config']);
  });

  it('replaces TARGET with variant name', () => {
    const path = ['project', 'TARGET', 'path'];
    const resolved = resolveVariant(path, 'beta');

    expect(resolved).toEqual(['project', 'beta', 'path']);
  });

  it('handles multiple uppercase occurrences', () => {
    const path = ['VARIANT', 'sub', 'TYPE'];
    const resolved = resolveVariant(path, 'test');

    expect(resolved).toEqual(['test', 'sub', 'test']);
  });

  it('returns same path if no uppercase components', () => {
    const path = ['product', 'alpha', 'path'];
    const resolved = resolveVariant(path, 'beta');

    expect(resolved).toEqual(['product', 'alpha', 'path']);
  });
});

describe('Converting path to string', () => {
  it('converts path array to dot notation', () => {
    expect(pathToString(['product', 'alpha', 'path'])).toBe(
      'product.alpha.path'
    );
    expect(pathToString(['simple'])).toBe('simple');
    expect(pathToString(['a', 'b', 'c', 'd'])).toBe('a.b.c.d');
  });
});

describe('Resolving from config', () => {
  const config = {
    product: {
      alpha: {
        path: '/data/alpha',
        enabled: true,
        count: 42,
      },
      beta: {
        path: '/data/beta',
      },
    },
  };

  it('resolves string value', () => {
    const value = resolveFromConfig(config, ['product', 'alpha', 'path']);

    expect(value).toBe('/data/alpha');
  });

  it('resolves boolean value', () => {
    const value = resolveFromConfig(config, ['product', 'alpha', 'enabled']);

    expect(value).toBe(true);
  });

  it('resolves number value', () => {
    const value = resolveFromConfig(config, ['product', 'alpha', 'count']);

    expect(value).toBe(42);
  });

  it('returns undefined for non-existent path', () => {
    const value = resolveFromConfig(config, ['product', 'gamma', 'path']);

    expect(value).toBeUndefined();
  });

  it('returns undefined for partial path', () => {
    const value = resolveFromConfig(config, ['product', 'alpha']);

    expect(value).toBeUndefined();
  });

  it('returns undefined for invalid path', () => {
    const value = resolveFromConfig(config, ['nonexistent']);

    expect(value).toBeUndefined();
  });
});

describe('Replacing placeholders', () => {
  const config = {
    product: {
      alpha: {
        path: '/data/alpha',
        enabled: true,
      },
    },
  };

  it('replaces single placeholder', () => {
    const result = replacePlaceholders('cd {product.alpha.path}', config);

    expect(result).toBe('cd /data/alpha');
  });

  it('replaces multiple placeholders', () => {
    const result = replacePlaceholders(
      'operation {product.alpha.path} --enabled {product.alpha.enabled}',
      config
    );

    expect(result).toBe('operation /data/alpha --enabled true');
  });

  it('keeps placeholder if not found in config', () => {
    const result = replacePlaceholders('cd {product.beta.path}', config);

    expect(result).toBe('cd {product.beta.path}');
  });

  it('handles text without placeholders', () => {
    const result = replacePlaceholders('plain text', config);

    expect(result).toBe('plain text');
  });
});

describe('Checking for placeholders', () => {
  it('returns true for text with placeholder', () => {
    expect(hasPlaceholders('cd {product.alpha.path}')).toBe(true);
    expect(hasPlaceholders('{simple}')).toBe(true);
  });

  it('returns false for text without placeholder', () => {
    expect(hasPlaceholders('plain text')).toBe(false);
    expect(hasPlaceholders('text with {incomplete')).toBe(false);
    expect(hasPlaceholders('text with incomplete}')).toBe(false);
  });
});

describe('Getting required config paths', () => {
  it('extracts config paths from strict placeholders', () => {
    const paths = getRequiredConfigPaths(
      'operation {product.alpha.path} --output {product.alpha.output}'
    );

    expect(paths).toContain('product.alpha.path');
    expect(paths).toContain('product.alpha.output');
    expect(paths).toHaveLength(2);
  });

  it('excludes variant placeholders with VARIANT keyword', () => {
    const paths = getRequiredConfigPaths(
      'run {product.VARIANT.command} in {product.alpha.path}'
    );

    expect(paths).toContain('product.alpha.path');
    expect(paths).not.toContain('product.VARIANT.command');
    expect(paths).toHaveLength(1);
  });

  it('excludes variant placeholders with TYPE keyword', () => {
    const paths = getRequiredConfigPaths(
      'setup {env.TYPE.config} using {env.common.settings}'
    );

    expect(paths).toContain('env.common.settings');
    expect(paths).not.toContain('env.TYPE.config');
    expect(paths).toHaveLength(1);
  });

  it('excludes variant placeholders with TARGET keyword', () => {
    const paths = getRequiredConfigPaths(
      'cd {project.TARGET.path} and run {tool.default.command}'
    );

    expect(paths).toContain('tool.default.command');
    expect(paths).not.toContain('project.TARGET.path');
    expect(paths).toHaveLength(1);
  });

  it('returns unique paths', () => {
    const paths = getRequiredConfigPaths(
      'use {product.alpha.path} and {product.alpha.path}'
    );

    expect(paths).toEqual(['product.alpha.path']);
  });

  it('returns empty array for text without placeholders', () => {
    const paths = getRequiredConfigPaths('no placeholders');

    expect(paths).toEqual([]);
  });
});
