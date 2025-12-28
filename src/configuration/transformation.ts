import { ConfigDefinition, ConfigDefinitionType } from './types.js';
import { getConfigSchema } from './schema.js';

/**
 * Convert string value to appropriate type based on schema definition
 */
export function parseConfigValue(
  key: string,
  stringValue: string,
  schema: Record<string, ConfigDefinition>
): unknown {
  // If we have a schema definition, use its type
  if (key in schema) {
    const definition = schema[key];
    switch (definition.type) {
      case ConfigDefinitionType.Boolean:
        return stringValue === 'true';
      case ConfigDefinitionType.Number:
        return Number(stringValue);
      case ConfigDefinitionType.String:
      case ConfigDefinitionType.RegExp:
      case ConfigDefinitionType.Enum:
        return stringValue;
    }
  }

  // No schema definition - try to infer type from string value
  // This handles skill-defined configs that may not be in schema yet
  if (stringValue === 'true' || stringValue === 'false') {
    return stringValue === 'true';
  }
  if (!isNaN(Number(stringValue)) && stringValue.trim() !== '') {
    return Number(stringValue);
  }
  return stringValue;
}

/**
 * Unflatten dotted keys into nested structure
 * Example: { "product.alpha.path": "value" } -> { product: { alpha: { path: "value" } } }
 * Converts string values to appropriate types based on config schema
 */
export function unflattenConfig(
  dotted: Record<string, string>
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  const schema = getConfigSchema();

  for (const [dottedKey, stringValue] of Object.entries(dotted)) {
    const parts = dottedKey.split('.');
    const section = parts[0];

    // Initialize section if needed
    result[section] = result[section] ?? {};

    // Build nested structure for this section
    let current = result[section];
    for (let i = 1; i < parts.length - 1; i++) {
      current[parts[i]] = current[parts[i]] ?? {};
      current = current[parts[i]] as Record<string, unknown>;
    }

    // Convert string value to appropriate type and set
    const typedValue = parseConfigValue(dottedKey, stringValue, schema);
    current[parts[parts.length - 1]] = typedValue;
  }

  return result;
}
