import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

export enum AnthropicModel {
  Sonnet = 'claude-sonnet-4-5',
  Haiku = 'claude-haiku-4-5',
  Opus = 'claude-opus-4-1',
}

export const SUPPORTED_MODELS = Object.values(AnthropicModel);

export type AnthropicConfig = {
  key: string;
  model?: string;
};

export type SettingsConfig = {
  debug?: boolean;
};

export interface Config {
  anthropic: AnthropicConfig;
  settings?: SettingsConfig;
}

/**
 * Base configuration definition with shared properties
 */
interface BaseConfigDefinition {
  required: boolean;
  description: string;
}

/**
 * Configuration definition types - discriminated union for type safety
 */
export type ConfigDefinition =
  | (BaseConfigDefinition & {
      type: 'regexp';
      pattern: RegExp;
    })
  | (BaseConfigDefinition & {
      type: 'string';
      default?: string;
    })
  | (BaseConfigDefinition & {
      type: 'enum';
      values: string[];
      default?: string;
    })
  | (BaseConfigDefinition & {
      type: 'number';
      default?: number;
    })
  | (BaseConfigDefinition & {
      type: 'boolean';
    });

export class ConfigError extends Error {
  origin?: Error;

  constructor(message: string, origin?: Error) {
    super(message);
    this.name = 'ConfigError';
    this.origin = origin;
  }
}

function getConfigFile(): string {
  return join(homedir(), '.plsrc');
}

function parseYamlConfig(content: string): unknown {
  try {
    return YAML.parse(content);
  } catch (error) {
    throw new ConfigError(
      'Failed to parse configuration file',
      error instanceof Error ? error : undefined
    );
  }
}

function validateConfig(parsed: unknown): Config {
  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigError('Invalid configuration format');
  }

  const config = parsed as Record<string, unknown>;

  // Validate anthropic section
  if (!config.anthropic || typeof config.anthropic !== 'object') {
    throw new ConfigError('Missing or invalid anthropic configuration');
  }

  const { key, model } = config.anthropic as AnthropicConfig;

  if (!key || typeof key !== 'string') {
    throw new ConfigError('Missing or invalid API key');
  }

  const validatedConfig: Config = {
    anthropic: {
      key,
    },
  };

  // Optional model - only set if valid
  if (model && typeof model === 'string' && isValidAnthropicModel(model)) {
    validatedConfig.anthropic.model = model;
  }

  // Optional settings section
  if (config.settings && typeof config.settings === 'object') {
    const settings = config.settings as Record<string, unknown>;
    validatedConfig.settings = {};

    if ('debug' in settings && typeof settings.debug === 'boolean') {
      validatedConfig.settings.debug = settings.debug;
    }
  }

  return validatedConfig;
}

export function loadConfig(): Config {
  const configFile = getConfigFile();
  if (!existsSync(configFile)) {
    throw new ConfigError('Configuration not found');
  }

  const content = readFileSync(configFile, 'utf-8');
  const parsed = parseYamlConfig(content);
  return validateConfig(parsed);
}

export function getConfigPath(): string {
  return getConfigFile();
}

export function configExists(): boolean {
  return existsSync(getConfigFile());
}

export function isValidAnthropicApiKey(key: string): boolean {
  // Anthropic API keys format: sk-ant-api03-XXXXX (108 chars total)
  // - Prefix: sk-ant-api03- (13 chars)
  // - Key body: 95 characters (uppercase, lowercase, digits, hyphens, underscores)
  const apiKeyPattern = /^sk-ant-api03-[A-Za-z0-9_-]{95}$/;
  return apiKeyPattern.test(key);
}

export function isValidAnthropicModel(model: string): boolean {
  return SUPPORTED_MODELS.includes(model as AnthropicModel);
}

export function hasValidAnthropicKey(): boolean {
  try {
    const config = loadConfig();
    return (
      !!config.anthropic.key && isValidAnthropicApiKey(config.anthropic.key)
    );
  } catch {
    return false;
  }
}

export function mergeConfig(
  existingContent: string,
  sectionName: string,
  newValues: Record<string, unknown>
): string {
  const parsed = existingContent.trim()
    ? (YAML.parse(existingContent) as Record<string, unknown>)
    : {};

  // Update or add section
  const section =
    (parsed[sectionName] as Record<string, unknown> | undefined) ?? {};
  for (const [key, value] of Object.entries(newValues)) {
    section[key] = value;
  }
  parsed[sectionName] = section;

  // Sort sections alphabetically
  const sortedKeys = Object.keys(parsed).sort();
  const sortedConfig: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedConfig[key] = parsed[key];
  }

  // Convert back to YAML
  return YAML.stringify(sortedConfig);
}

export function saveConfig(
  section: string,
  config: Record<string, unknown>
): void {
  const configFile = getConfigFile();
  const existingContent = existsSync(configFile)
    ? readFileSync(configFile, 'utf-8')
    : '';

  const newContent = mergeConfig(existingContent, section, config);

  writeFileSync(configFile, newContent, 'utf-8');
}

export function saveAnthropicConfig(config: AnthropicConfig): Config {
  saveConfig('anthropic', config);
  return loadConfig();
}

export function saveDebugSetting(debug: boolean): void {
  saveConfig('settings', { debug });
}

export function loadDebugSetting(): boolean {
  try {
    const config = loadConfig();
    return config.settings?.debug ?? false;
  } catch {
    return false;
  }
}

/**
 * Returns a message requesting initial setup.
 * Provides natural language variations that sound like a professional concierge
 * preparing to serve, avoiding technical jargon.
 *
 * @param forFutureUse - If true, indicates setup is for future requests rather than
 *                       an immediate task
 */
export function getConfigurationRequiredMessage(forFutureUse = false): string {
  if (forFutureUse) {
    const messages = [
      "Before I can assist with your requests, let's get a few things ready.",
      'Let me set up a few things so I can help you in the future.',
      "I'll need to prepare a few things before I can assist you.",
      "Let's get everything ready so I can help with your tasks.",
      "I need to set up a few things first, then I'll be ready to assist.",
      'Let me prepare everything so I can help you going forward.',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  const messages = [
    'Before I can help, let me get a few things ready.',
    'I need to set up a few things first.',
    'Let me prepare everything before we begin.',
    'Just a moment while I get ready to assist you.',
    "I'll need to get set up before I can help with that.",
    'Let me get everything ready for you.',
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Core configuration schema - defines structure and types for built-in settings
 */
const coreConfigSchema: Record<string, ConfigDefinition> = {
  'anthropic.key': {
    type: 'regexp',
    required: true,
    pattern: /^sk-ant-api03-[A-Za-z0-9_-]{95}$/,
    description: 'Anthropic API key',
  },
  'anthropic.model': {
    type: 'enum',
    required: true,
    values: SUPPORTED_MODELS,
    default: AnthropicModel.Haiku,
    description: 'Anthropic model',
  },
  'settings.debug': {
    type: 'boolean',
    required: false,
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
      case 'regexp':
        isValid = typeof value === 'string' && definition.pattern.test(value);
        break;
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'enum':
        isValid =
          typeof value === 'string' && definition.values.includes(value);
        break;
      case 'number':
        isValid = typeof value === 'number';
        break;
      case 'boolean':
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
 * Get available config structure for CONFIG tool
 * Returns keys with descriptions only (no values for privacy)
 */
export function getAvailableConfigStructure(): Record<string, string> {
  const schema = getConfigSchema();
  const structure: Record<string, string> = {};

  // Add core schema keys with descriptions
  for (const [key, definition] of Object.entries(schema)) {
    structure[key] = definition.description;
  }

  // Add discovered keys from config file (if it exists)
  try {
    const configFile = getConfigFile();
    if (!existsSync(configFile)) {
      return structure;
    }

    const content = readFileSync(configFile, 'utf-8');
    const parsed = YAML.parse(content) as Record<string, unknown>;

    // Flatten nested config to dot notation
    function flattenConfig(
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

    const flatConfig = flattenConfig(parsed);

    // Add discovered keys that aren't in schema
    for (const key of Object.keys(flatConfig)) {
      if (!structure[key]) {
        structure[key] = `${key} (discovered)`;
      }
    }
  } catch {
    // Config file doesn't exist or can't be read, only use schema
  }

  return structure;
}

/**
 * Convert string value to appropriate type based on schema definition
 */
function parseConfigValue(
  key: string,
  stringValue: string,
  schema: Record<string, ConfigDefinition>
): unknown {
  // If we have a schema definition, use its type
  if (key in schema) {
    const definition = schema[key];
    switch (definition.type) {
      case 'boolean':
        return stringValue === 'true';
      case 'number':
        return Number(stringValue);
      case 'string':
      case 'regexp':
      case 'enum':
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
