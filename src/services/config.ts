import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

export type AnthropicConfig = {
  key: string;
  model?: string;
};

export interface Config {
  anthropic: AnthropicConfig;
}

export class ConfigError extends Error {
  origin?: Error;

  constructor(message: string, origin?: Error) {
    super(message);
    this.name = 'ConfigError';
    this.origin = origin;
  }
}

const CONFIG_FILE = join(homedir(), '.plsrc');

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

  // Optional model
  if (model && typeof model === 'string') {
    validatedConfig.anthropic.model = model;
  }

  return validatedConfig;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    throw new ConfigError('Configuration not found');
  }

  const content = readFileSync(CONFIG_FILE, 'utf-8');
  const parsed = parseYamlConfig(content);
  return validateConfig(parsed);
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function configExists(): boolean {
  return existsSync(CONFIG_FILE);
}

export function hasValidConfig(): boolean {
  try {
    const config = loadConfig();
    return !!config.anthropic.key;
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
  const existingContent = existsSync(CONFIG_FILE)
    ? readFileSync(CONFIG_FILE, 'utf-8')
    : '';

  const newContent = mergeConfig(existingContent, section, config);

  writeFileSync(CONFIG_FILE, newContent, 'utf-8');
}

export function saveAnthropicConfig(config: AnthropicConfig): void {
  saveConfig('anthropic', config);
}
