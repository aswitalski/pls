import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

import { AnthropicConfig, Config, ConfigError, DebugLevel } from './types.js';

import { defaultFileSystem, FileSystem } from '../services/filesystem.js';
import { isValidAnthropicApiKey, validateConfig } from './validation.js';

const RUNTIME_CONFIGURATION_FILE = '.plsrc';

function getConfigFile(): string {
  return join(homedir(), RUNTIME_CONFIGURATION_FILE);
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

export function getConfigPath(): string {
  return getConfigFile();
}

export function configExists(fs: FileSystem = defaultFileSystem): boolean {
  return fs.exists(getConfigFile());
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
  const tempFile = `${configFile}.tmp`;

  const existingContent = fs.exists(configFile)
    ? fs.readFile(configFile, 'utf-8')
    : '';

  const newContent = mergeConfig(existingContent, section, config);

  try {
    // Write to temp file first
    fs.writeFile(tempFile, newContent);

    // Validate the temp file can be parsed
    const tempContent = fs.readFile(tempFile, 'utf-8');
    parseYamlConfig(tempContent);

    // Atomic rename (on POSIX systems)
    fs.rename(tempFile, configFile);
  } catch (error) {
    // Clean up temp file if it exists
    if (fs.exists(tempFile)) {
      try {
        fs.remove(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
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
