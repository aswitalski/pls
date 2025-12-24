import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Get the path to the config labels cache file
 */
export function getConfigLabelsCachePath(): string {
  return join(homedir(), '.pls', 'cache', 'config.json');
}

/**
 * Get the cache directory path
 */
function getCacheDirectoryPath(): string {
  return join(homedir(), '.pls', 'cache');
}

/**
 * Ensure the cache directory exists
 */
function ensureCacheDirectoryExists(): void {
  const cacheDir = getCacheDirectoryPath();
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * Load config labels from cache file
 * Returns empty object if file doesn't exist or is corrupted
 */
export function loadConfigLabels(): Record<string, string> {
  try {
    const cachePath = getConfigLabelsCachePath();
    if (!existsSync(cachePath)) {
      return {};
    }

    const content = readFileSync(cachePath, 'utf-8');
    const parsed: unknown = JSON.parse(content);

    // Validate that parsed content is an object
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return parsed as Record<string, string>;
  } catch {
    // Return empty object on any error (parse error, read error, etc.)
    return {};
  }
}

/**
 * Save multiple config labels to cache
 */
export function saveConfigLabels(labels: Record<string, string>): void {
  ensureCacheDirectoryExists();

  // Load existing labels and merge with new ones
  const existing = loadConfigLabels();
  const merged = { ...existing, ...labels };

  const cachePath = getConfigLabelsCachePath();
  const content = JSON.stringify(merged, null, 2);
  writeFileSync(cachePath, content, 'utf-8');
}

/**
 * Save a single config label to cache
 */
export function saveConfigLabel(key: string, label: string): void {
  saveConfigLabels({ [key]: label });
}

/**
 * Get a config label from cache
 * Returns undefined if label doesn't exist
 */
export function getConfigLabel(key: string): string | undefined {
  const labels = loadConfigLabels();
  return labels[key];
}
