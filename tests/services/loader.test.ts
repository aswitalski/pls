import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getConfigValue,
  hasConfigPath,
  loadUserConfig,
} from '../../src/services/loader.js';

import { safeRemoveDirectory } from '../test-utils.js';

describe('Loading user config', () => {
  let testDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `pls-test-${Date.now().toString()}-${Math.random().toString()}`
    );
    mkdirSync(testDir, { recursive: true });
    originalHome = process.env.HOME;
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    safeRemoveDirectory(testDir);
  });

  it('loads valid YAML config from ~/.plsrc', () => {
    const configPath = join(testDir, '.plsrc');
    writeFileSync(
      configPath,
      `
product:
  alpha:
    path: /data/alpha
    enabled: true
  beta:
    path: /data/beta
`,
      'utf-8'
    );

    const config = loadUserConfig();

    expect(config).toEqual({
      product: {
        alpha: {
          path: '/data/alpha',
          enabled: true,
        },
        beta: {
          path: '/data/beta',
        },
      },
    });
  });

  it('returns empty object when config file does not exist', () => {
    const config = loadUserConfig();

    expect(config).toEqual({});
  });

  it('returns empty object when config is malformed YAML', () => {
    const configPath = join(testDir, '.plsrc');
    writeFileSync(
      configPath,
      `
invalid: yaml: syntax:
  - broken
    indentation
`,
      'utf-8'
    );

    const config = loadUserConfig();

    expect(config).toEqual({});
  });

  it('returns empty object when config is not an object', () => {
    const configPath = join(testDir, '.plsrc');
    writeFileSync(configPath, 'just a string', 'utf-8');

    const config = loadUserConfig();

    expect(config).toEqual({});
  });

  it('handles nested config structures', () => {
    const configPath = join(testDir, '.plsrc');
    writeFileSync(
      configPath,
      `
app:
  database:
    primary:
      host: localhost
      port: 5432
    secondary:
      host: remote
`,
      'utf-8'
    );

    const config = loadUserConfig();

    expect(config).toEqual({
      app: {
        database: {
          primary: {
            host: 'localhost',
            port: 5432,
          },
          secondary: {
            host: 'remote',
          },
        },
      },
    });
  });
});

describe('Checking config path', () => {
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
    simple: 'value',
  };

  it('returns true for valid flat path', () => {
    expect(hasConfigPath(config, 'simple')).toBe(true);
  });

  it('returns true for valid nested path with string value', () => {
    expect(hasConfigPath(config, 'product.alpha.path')).toBe(true);
  });

  it('returns true for valid nested path with boolean value', () => {
    expect(hasConfigPath(config, 'product.alpha.enabled')).toBe(true);
  });

  it('returns true for valid nested path with number value', () => {
    expect(hasConfigPath(config, 'product.alpha.count')).toBe(true);
  });

  it('returns false for non-existent path', () => {
    expect(hasConfigPath(config, 'product.gamma.path')).toBe(false);
    expect(hasConfigPath(config, 'nonexistent')).toBe(false);
  });

  it('returns false for partial path pointing to object', () => {
    expect(hasConfigPath(config, 'product.alpha')).toBe(false);
    expect(hasConfigPath(config, 'product')).toBe(false);
  });

  it('returns false for null value', () => {
    const configWithNull = {
      setting: null,
    };

    expect(hasConfigPath(configWithNull, 'setting')).toBe(false);
  });

  it('returns false for undefined value', () => {
    const configWithUndefined = {
      setting: undefined,
    };

    expect(hasConfigPath(configWithUndefined, 'setting')).toBe(false);
  });
});

describe('Getting config value', () => {
  const config = {
    product: {
      alpha: {
        path: '/data/alpha',
        enabled: true,
        count: 42,
      },
      beta: {
        path: '/data/beta',
        disabled: false,
      },
    },
    simple: 'value',
  };

  it('returns string value for valid path', () => {
    expect(getConfigValue(config, 'product.alpha.path')).toBe('/data/alpha');
    expect(getConfigValue(config, 'simple')).toBe('value');
  });

  it('returns boolean value for valid path', () => {
    expect(getConfigValue(config, 'product.alpha.enabled')).toBe(true);
    expect(getConfigValue(config, 'product.beta.disabled')).toBe(false);
  });

  it('returns number value for valid path', () => {
    expect(getConfigValue(config, 'product.alpha.count')).toBe(42);
  });

  it('returns undefined for non-existent path', () => {
    expect(getConfigValue(config, 'product.gamma.path')).toBeUndefined();
    expect(getConfigValue(config, 'nonexistent')).toBeUndefined();
  });

  it('returns undefined for partial path', () => {
    expect(getConfigValue(config, 'product.alpha')).toBeUndefined();
    expect(getConfigValue(config, 'product')).toBeUndefined();
  });

  it('handles deeply nested paths', () => {
    const deepConfig = {
      app: {
        database: {
          primary: {
            connection: {
              host: 'localhost',
            },
          },
        },
      },
    };

    expect(
      getConfigValue(deepConfig, 'app.database.primary.connection.host')
    ).toBe('localhost');
  });
});
