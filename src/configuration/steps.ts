import { parse as parseYaml } from 'yaml';

import { Config, ConfigDefinition, ConfigDefinitionType } from './types.js';
import { getConfigPath, loadConfig } from './io.js';
import { getConfigSchema } from './schema.js';
import { getConfigLabel } from './labels.js';
import { defaultFileSystem, FileSystem } from '../services/filesystem.js';

import { ConfigStep, StepType } from '../ui/Config.js';

export function createConfigSteps(): ConfigStep[] {
  // Use schema-based config step generation for required Anthropic settings
  return createConfigStepsFromSchema(['anthropic.key', 'anthropic.model']);
}

/**
 * Get current config value for a dotted key path
 */
function getConfigValue(
  config: Config | Record<string, unknown> | null,
  key: string
): unknown {
  if (!config) return undefined;

  const parts = key.split('.');
  let value: unknown = config;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Get validation function for a config definition
 */
function getValidator(
  definition: ConfigDefinition
): (value: string) => boolean {
  switch (definition.type) {
    case ConfigDefinitionType.RegExp:
      return (value: string) => definition.pattern.test(value);
    case ConfigDefinitionType.String:
      return () => true; // Strings are always valid
    case ConfigDefinitionType.Enum:
      return (value: string) => definition.values.includes(value);
    case ConfigDefinitionType.Number:
      return (value: string) => !isNaN(Number(value));
    case ConfigDefinitionType.Boolean:
      return (value: string) => value === 'true' || value === 'false';
  }
}

/**
 * Create config steps from schema for specified keys
 */
export function createConfigStepsFromSchema(
  keys: string[],
  fs: FileSystem = defaultFileSystem
): ConfigStep[] {
  const schema = getConfigSchema();
  let currentConfig: Config | null = null;
  let rawConfig: Record<string, unknown> | null = null;

  // Load validated config (may fail if config has validation errors)
  try {
    currentConfig = loadConfig(fs);
  } catch {
    // Config doesn't exist or has validation errors, use defaults
  }

  // Load raw config separately (for discovered keys not in schema)
  try {
    const configFile = getConfigPath();
    if (fs.exists(configFile)) {
      const content = fs.readFile(configFile, 'utf-8');
      rawConfig = parseYaml(content) as Record<string, unknown>;
    }
  } catch {
    // Config file doesn't exist or can't be parsed
  }

  return keys.map((key) => {
    // Check if key is in schema (system config)
    if (!(key in schema)) {
      // Key is not in schema - it's from a skill or discovered config
      // Create a simple text step with cached label or full path as description
      const keyParts = key.split('.');
      const shortKey = keyParts[keyParts.length - 1];

      // Load current value if it exists (use rawConfig since discovered keys aren't in validated config)
      const currentValue = getConfigValue(rawConfig, key);
      const value =
        currentValue !== undefined && typeof currentValue === 'string'
          ? currentValue
          : null;

      // Use cached label if available, fallback to key path
      const cachedLabel = getConfigLabel(key, fs);

      return {
        description: cachedLabel ?? key,
        key: shortKey,
        path: key,
        type: StepType.Text,
        value,
        validate: () => true, // Accept any string for now
      };
    }
    const definition = schema[key];

    const currentValue = getConfigValue(currentConfig, key);
    const keyParts = key.split('.');
    const shortKey = keyParts[keyParts.length - 1];

    // Map definition to ConfigStep based on type
    switch (definition.type) {
      case ConfigDefinitionType.RegExp:
      case ConfigDefinitionType.String: {
        const value =
          currentValue !== undefined && typeof currentValue === 'string'
            ? currentValue
            : definition.type === ConfigDefinitionType.String
              ? (definition.default ?? '')
              : null;

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Text,
          value,
          validate: getValidator(definition),
        };
      }

      case ConfigDefinitionType.Number: {
        const value =
          currentValue !== undefined && typeof currentValue === 'number'
            ? String(currentValue)
            : definition.default !== undefined
              ? String(definition.default)
              : '0';

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Text,
          value,
          validate: getValidator(definition),
        };
      }

      case ConfigDefinitionType.Enum: {
        const currentStr =
          currentValue !== undefined && typeof currentValue === 'string'
            ? currentValue
            : definition.default;

        const defaultIndex = currentStr
          ? definition.values.indexOf(currentStr)
          : 0;

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Selection,
          options: definition.values.map((value) => ({
            label: value,
            value,
          })),
          defaultIndex: Math.max(0, defaultIndex),
          validate: getValidator(definition),
        };
      }

      case ConfigDefinitionType.Boolean: {
        const currentBool =
          currentValue !== undefined && typeof currentValue === 'boolean'
            ? currentValue
            : undefined;

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Selection,
          options: [
            { label: 'yes', value: 'true' },
            { label: 'no', value: 'false' },
          ],
          defaultIndex: currentBool !== undefined ? (currentBool ? 0 : 1) : 0,
          validate: getValidator(definition),
        };
      }
    }
  });
}
