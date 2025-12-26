import { homedir } from 'os';
import { join } from 'path';

import { defaultFileSystem, FileSystem } from './filesystem.js';

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
function ensureCacheDirectoryExists(fs: FileSystem = defaultFileSystem): void {
  const cacheDir = getCacheDirectoryPath();
  if (!fs.exists(cacheDir)) {
    fs.createDirectory(cacheDir, { recursive: true });
  }
}

/**
 * Load config labels from cache file
 * Returns empty object if file doesn't exist or is corrupted
 */
export function loadConfigLabels(
  fs: FileSystem = defaultFileSystem
): Record<string, string> {
  try {
    const cachePath = getConfigLabelsCachePath();
    if (!fs.exists(cachePath)) {
      return {};
    }

    const content = fs.readFile(cachePath, 'utf-8');
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
export function saveConfigLabels(
  labels: Record<string, string>,
  fs: FileSystem = defaultFileSystem
): void {
  ensureCacheDirectoryExists(fs);

  // Load existing labels and merge with new ones
  const existing = loadConfigLabels(fs);
  const merged = { ...existing, ...labels };

  const cachePath = getConfigLabelsCachePath();
  const content = JSON.stringify(merged, null, 2);
  fs.writeFile(cachePath, content);
}

/**
 * Save a single config label to cache
 */
export function saveConfigLabel(
  key: string,
  label: string,
  fs: FileSystem = defaultFileSystem
): void {
  saveConfigLabels({ [key]: label }, fs);
}

/**
 * Get a config label from cache
 * Returns undefined if label doesn't exist
 */
export function getConfigLabel(
  key: string,
  fs: FileSystem = defaultFileSystem
): string | undefined {
  const labels = loadConfigLabels(fs);
  return labels[key];
}
