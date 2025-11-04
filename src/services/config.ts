import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
}

export interface UIConfig {
  theme?: string;
  verbose?: boolean;
}

export interface Config {
  anthropic: AnthropicConfig;
  ui?: UIConfig;
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
        '  api-key: sk-ant-...'
    );
  }

  const anthropic = config.anthropic as Record<string, unknown>;

  // Support both 'api-key' (kebab-case) and 'apiKey' (camelCase)
  const apiKey = anthropic['api-key'] || anthropic.apiKey;

  if (!apiKey || typeof apiKey !== 'string') {
    throw new ConfigError(
      `\nMissing or invalid 'anthropic.api-key' in ${CONFIG_FILE}\n` +
        'Please add your Anthropic API key:\n' +
        'anthropic:\n' +
        '  api-key: sk-ant-...'
    );
  }

  const validatedConfig: Config = {
    anthropic: {
      apiKey: apiKey,
    },
  };

  // Optional model
  if (anthropic.model && typeof anthropic.model === 'string') {
    validatedConfig.anthropic.model = anthropic.model;
  }

  // Optional UI config
  if (config.ui && typeof config.ui === 'object') {
    const ui = config.ui as Record<string, unknown>;
    validatedConfig.ui = {};

    if (ui.theme && typeof ui.theme === 'string') {
      validatedConfig.ui.theme = ui.theme;
    }

    if (typeof ui.verbose === 'boolean') {
      validatedConfig.ui.verbose = ui.verbose;
    }
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
        '  api-key: sk-ant-...\n' +
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
  newValues: Record<string, string>
): string {
  const parsed = existingContent.trim()
    ? (YAML.parse(existingContent) as Record<string, unknown>) || {}
    : {};

  // Update or add section
  const section = (parsed[sectionName] as Record<string, unknown>) || {};
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

export function saveConfig(apiKey: string, model: string): void {
  const existingContent = existsSync(CONFIG_FILE)
    ? readFileSync(CONFIG_FILE, 'utf-8')
    : '';

  const newContent = mergeConfig(existingContent, 'anthropic', {
    'api-key': apiKey,
    model: model,
  });

  writeFileSync(CONFIG_FILE, newContent, 'utf-8');
}
