/**
 * Utility functions for config manipulation
 */

/**
 * Flatten nested config object to dot notation
 * Example: { a: { b: 1 } } => { 'a.b': 1 }
 */
export function flattenConfig(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenConfig(value as Record<string, unknown>, fullKey)
      );
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}
