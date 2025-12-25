import { describe, expect, it } from 'vitest';

import { flattenConfig } from '../../src/services/config-utils.js';

describe('flattenConfig', () => {
  it('flattens nested object to dot notation', () => {
    const input = {
      a: {
        b: {
          c: 'value',
        },
      },
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      'a.b.c': 'value',
    });
  });

  it('handles multiple nested keys', () => {
    const input = {
      project: {
        alpha: {
          path: '/path/to/alpha',
          enabled: true,
        },
        beta: {
          path: '/path/to/beta',
          enabled: false,
        },
      },
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      'project.alpha.path': '/path/to/alpha',
      'project.alpha.enabled': true,
      'project.beta.path': '/path/to/beta',
      'project.beta.enabled': false,
    });
  });

  it('handles top-level keys', () => {
    const input = {
      key1: 'value1',
      key2: 'value2',
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      key1: 'value1',
      key2: 'value2',
    });
  });

  it('handles mixed nested and top-level keys', () => {
    const input = {
      topLevel: 'value',
      nested: {
        inner: 'innerValue',
      },
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      topLevel: 'value',
      'nested.inner': 'innerValue',
    });
  });

  it('preserves arrays as values', () => {
    const input = {
      list: ['item1', 'item2'],
      nested: {
        list: ['a', 'b'],
      },
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      list: ['item1', 'item2'],
      'nested.list': ['a', 'b'],
    });
  });

  it('handles null values', () => {
    const input = {
      nullValue: null,
      nested: {
        alsoNull: null,
      },
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      nullValue: null,
      'nested.alsoNull': null,
    });
  });

  it('handles empty object', () => {
    const input = {};

    const result = flattenConfig(input);

    expect(result).toEqual({});
  });

  it('handles deeply nested structures', () => {
    const input = {
      a: {
        b: {
          c: {
            d: {
              e: 'deep',
            },
          },
        },
      },
    };

    const result = flattenConfig(input);

    expect(result).toEqual({
      'a.b.c.d.e': 'deep',
    });
  });

  it('uses custom prefix when provided', () => {
    const input = {
      key: 'value',
      nested: {
        inner: 'innerValue',
      },
    };

    const result = flattenConfig(input, 'prefix');

    expect(result).toEqual({
      'prefix.key': 'value',
      'prefix.nested.inner': 'innerValue',
    });
  });
});
