import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

export interface AnthropicConfig {
  key: string;
  model?: string;
}

export interface Config {
  anthropic: AnthropicConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const CONFIG_FILE = join(homedir(), '.plsrc');

function parseYamlConfig(content: string): unknown {
  try {
    return YAML.parse(content);
  } catch (error) {
    throw new ConfigError(
      `\nFailed to parse YAML configuration file at ${CONFIG_FILE}\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function validateConfig(parsed: unknown): Config {
  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigError(
      `\nInvalid configuration format in ${CONFIG_FILE}\n` +
        'Expected a YAML object with configuration settings.'
    );
  }

  const config = parsed as Record<string, unknown>;

  // Validate anthropic section
  if (!config.anthropic || typeof config.anthropic !== 'object') {
    throw new ConfigError(
      `\nMissing or invalid 'anthropic' section in ${CONFIG_FILE}\n` +
        'Please add:\n' +
        'anthropic:\n' +
        '  key: sk-ant-...'
    );
  }

  const anthropic = config.anthropic as Record<string, unknown>;

  const key = anthropic['key'];

  if (!key || typeof key !== 'string') {
    throw new ConfigError(
      `\nMissing or invalid 'anthropic.key' in ${CONFIG_FILE}\n` +
        'Please add your Anthropic API key:\n' +
        'anthropic:\n' +
        '  key: sk-ant-...'
    );
  }

  const validatedConfig: Config = {
    anthropic: {
      key,
    },
  };

  // Optional model
  if (anthropic.model && typeof anthropic.model === 'string') {
    validatedConfig.anthropic.model = anthropic.model;
  }

  return validatedConfig;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    throw new ConfigError(
      `\nConfiguration file not found at ${CONFIG_FILE}\n\n` +
        'Please create it with your Anthropic API key.\n' +
        'Example:\n\n' +
        'anthropic:\n' +
        '  key: sk-ant-...\n' +
        '  model: claude-haiku-4-5-20251001\n'
    );
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
