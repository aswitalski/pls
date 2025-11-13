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

export function saveAnthropicConfig(config: AnthropicConfig): void {
  saveConfig('anthropic', config);
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
