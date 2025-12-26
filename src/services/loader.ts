import { homedir } from 'os';
import { join } from 'path';
import YAML from 'yaml';

import { defaultFileSystem, FileSystem } from './filesystem.js';
import { displayWarning } from './logger.js';

/**
 * Load user config from ~/.plsrc
 */
export function loadUserConfig(
  fs: FileSystem = defaultFileSystem
): Record<string, unknown> {
  const configPath = join(homedir(), '.plsrc');

  if (!fs.exists(configPath)) {
    return {};
  }

  try {
    const content = fs.readFile(configPath, 'utf-8');
    const parsed: unknown = YAML.parse(content);

    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }

    displayWarning('User config file exists but is not a valid object');
    return {};
  } catch (error) {
    displayWarning('Failed to load user config', error);
    return {};
  }
}

/**
 * Check if config has a specific path
 */
export function hasConfigPath(
  config: Record<string, unknown>,
  path: string
): boolean {
  const parts = path.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return false;
    }

    if (typeof current !== 'object') {
      return false;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return (
    current !== null &&
    current !== undefined &&
    (typeof current === 'string' ||
      typeof current === 'boolean' ||
      typeof current === 'number')
  );
}

/**
 * Get config value at path
 */
export function getConfigValue(
  config: Record<string, unknown>,
  path: string
): string | boolean | number | undefined {
  const parts = path.split('.');
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  if (
    typeof current === 'string' ||
    typeof current === 'boolean' ||
    typeof current === 'number'
  ) {
    return current;
  }

  return undefined;
}
