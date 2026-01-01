import YAML from 'yaml';

import {
  AnthropicModel,
  Config,
  ConfigDefinition,
  ConfigDefinitionType,
  DebugLevel,
  SUPPORTED_DEBUG_LEVELS,
  SUPPORTED_MODELS,
} from './types.js';

import { flattenConfig } from './transformation.js';
import { getConfigLabel } from './labels.js';
import { defaultFileSystem, FileSystem } from '../services/filesystem.js';
import { getConfigPath, loadConfig } from './io.js';

/**
 * Convert a dotted config key to a readable label
 * Example: "project.alpha.repo" -> "Project Alpha Repo"
 */
export function keyToLabel(key: string): string {
  return key
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Core configuration schema - defines structure and types for system settings
 */
const coreConfigSchema: Record<string, ConfigDefinition> = {
  'anthropic.key': {
    type: ConfigDefinitionType.RegExp,
    required: true,
    pattern: /^sk-ant-api03-[A-Za-z0-9_-]{95}$/,
    description: 'Anthropic API key',
  },
  'anthropic.model': {
    type: ConfigDefinitionType.Enum,
    required: true,
    values: SUPPORTED_MODELS,
    default: AnthropicModel.Haiku,
    description: 'Anthropic model',
  },
  'settings.debug': {
    type: ConfigDefinitionType.Enum,
    required: false,
    values: SUPPORTED_DEBUG_LEVELS,
    default: DebugLevel.None,
    description: 'Debug mode',
  },
};

/**
 * Get complete configuration schema
 * Currently returns core schema only
 * Future: will merge with skill-declared schemas
 */
export function getConfigSchema(): Record<string, ConfigDefinition> {
  return {
    ...coreConfigSchema,
    // Future: ...loadSkillSchemas()
  };
}

/**
 * Get missing required configuration keys
 * Returns array of keys that are required but not present or invalid in config
 */
export function getMissingConfigKeys(): string[] {
  const schema = getConfigSchema();
  const missing: string[] = [];

  let currentConfig: Config | null = null;
  try {
    currentConfig = loadConfig();
  } catch {
    // Config doesn't exist
  }

  for (const [key, definition] of Object.entries(schema)) {
    if (!definition.required) {
      continue;
    }

    // Get current value for this key
    const parts = key.split('.');
    let value: unknown = currentConfig;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    // Check if value is missing or invalid
    if (value === undefined || value === null) {
      missing.push(key);
      continue;
    }

    // Validate based on type
    let isValid = false;
    switch (definition.type) {
      case ConfigDefinitionType.RegExp:
        isValid = typeof value === 'string' && definition.pattern.test(value);
        break;
      case ConfigDefinitionType.String:
        isValid = typeof value === 'string';
        break;
      case ConfigDefinitionType.Enum:
        isValid =
          typeof value === 'string' && definition.values.includes(value);
        break;
      case ConfigDefinitionType.Number:
        isValid = typeof value === 'number';
        break;
      case ConfigDefinitionType.Boolean:
        isValid = typeof value === 'boolean';
        break;
    }

    if (!isValid) {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Get list of configured keys from config file
 * Returns array of dot-notation keys that exist in the config file
 */
export function getConfiguredKeys(
  fs: FileSystem = defaultFileSystem
): string[] {
  try {
    const configFile = getConfigPath();
    if (!fs.exists(configFile)) {
      return [];
    }

    const content = fs.readFile(configFile, 'utf-8');
    const parsed = YAML.parse(content) as Record<string, unknown>;

    // Flatten nested config to dot notation
    const flatConfig = flattenConfig(parsed);
    return Object.keys(flatConfig);
  } catch {
    return [];
  }
}

/**
 * Get available config structure for CONFIG tool
 * Returns keys with descriptions only (no values for privacy)
 * Marks optional keys as "(optional)"
 */
export function getAvailableConfigStructure(
  fs: FileSystem = defaultFileSystem
): Record<string, string> {
  const schema = getConfigSchema();
  const structure: Record<string, string> = {};

  // Try to load existing config to see which keys are already set
  let flatConfig: Record<string, unknown> = {};
  try {
    const configFile = getConfigPath();
    if (fs.exists(configFile)) {
      const content = fs.readFile(configFile, 'utf-8');
      const parsed = YAML.parse(content) as Record<string, unknown>;

      // Flatten nested config to dot notation
      flatConfig = flattenConfig(parsed);
    }
  } catch {
    // Config file doesn't exist or can't be read
  }

  // Add schema keys with descriptions
  for (const [key, definition] of Object.entries(schema)) {
    structure[key] = definition.description;
  }

  // Add discovered keys that aren't in schema
  for (const key of Object.keys(flatConfig)) {
    if (!(key in structure)) {
      structure[key] = getConfigLabel(key) || keyToLabel(key);
    }
  }

  return structure;
}
