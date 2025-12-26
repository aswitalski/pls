import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

import { getConfigLabel } from './config-labels.js';
import { flattenConfig } from './config-utils.js';
import { defaultFileSystem, FileSystem } from './filesystem.js';

/**
 * Convert a dotted config key to a readable label
 * Example: "project.alpha.repo" -> "Project Alpha Repo"
 */
function keyToLabel(key: string): string {
  return key
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export enum AnthropicModel {
  Sonnet = 'claude-sonnet-4-5',
  Haiku = 'claude-haiku-4-5',
  Opus = 'claude-opus-4-1',
}

export const SUPPORTED_MODELS = Object.values(AnthropicModel);

export enum DebugLevel {
  None = 'none',
  Info = 'info',
  Verbose = 'verbose',
}

export const SUPPORTED_DEBUG_LEVELS = Object.values(DebugLevel);

export type AnthropicConfig = {
  key: string;
  model?: string;
};

export type SettingsConfig = {
  debug?: DebugLevel;
};

export interface Config {
  anthropic: AnthropicConfig;
  settings?: SettingsConfig;
}

export enum ConfigDefinitionType {
  RegExp = 'regexp',
  String = 'string',
  Enum = 'enum',
  Number = 'number',
  Boolean = 'boolean',
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
      type: ConfigDefinitionType.RegExp;
      pattern: RegExp;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.String;
      default?: string;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.Enum;
      values: string[];
      default?: string;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.Number;
      default?: number;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.Boolean;
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

    if ('debug' in settings) {
      // Handle migration from boolean to enum
      if (typeof settings.debug === 'boolean') {
        validatedConfig.settings.debug = settings.debug
          ? DebugLevel.Info
          : DebugLevel.None;
      } else if (
        typeof settings.debug === 'string' &&
        SUPPORTED_DEBUG_LEVELS.includes(settings.debug as DebugLevel)
      ) {
        validatedConfig.settings.debug = settings.debug as DebugLevel;
      }
    }
  }

  return validatedConfig;
}

export function loadConfig(fs: FileSystem = defaultFileSystem): Config {
  const configFile = getConfigFile();
  if (!fs.exists(configFile)) {
    throw new ConfigError('Configuration not found');
  }

  const content = fs.readFile(configFile, 'utf-8');
  const parsed = parseYamlConfig(content);
  return validateConfig(parsed);
}

export function getConfigPath(): string {
  return getConfigFile();
}

export function configExists(fs: FileSystem = defaultFileSystem): boolean {
  return fs.exists(getConfigFile());
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
  config: Record<string, unknown>,
  fs: FileSystem = defaultFileSystem
): void {
  const configFile = getConfigFile();
  const existingContent = fs.exists(configFile)
    ? fs.readFile(configFile, 'utf-8')
    : '';

  const newContent = mergeConfig(existingContent, section, config);

  fs.writeFile(configFile, newContent);
}

export function saveAnthropicConfig(
  config: AnthropicConfig,
  fs: FileSystem = defaultFileSystem
): Config {
  saveConfig('anthropic', config, fs);
  return loadConfig(fs);
}

export function saveDebugSetting(
  debug: DebugLevel,
  fs: FileSystem = defaultFileSystem
): void {
  saveConfig('settings', { debug }, fs);
}

export function loadDebugSetting(
  fs: FileSystem = defaultFileSystem
): DebugLevel {
  try {
    const config = loadConfig(fs);
    return config.settings?.debug ?? DebugLevel.None;
  } catch {
    return DebugLevel.None;
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
    const configFile = getConfigFile();
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
    const configFile = getConfigFile();
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
