import { PlaceholderInfo } from '../types/skills.js';

/**
 * Check if a string is all uppercase (variant placeholder indicator)
 */
function isUpperCase(str: string): boolean {
  return str === str.toUpperCase() && str !== str.toLowerCase();
}

/**
 * Parse placeholder from string
 * Returns placeholder info or null if no valid placeholder found
 */
export function parsePlaceholder(text: string): PlaceholderInfo | null {
  // Match {path.to.property} format
  const match = text.match(/\{([^}]+)\}/);

  if (!match) {
    return null;
  }

  const original = match[0];
  const pathString = match[1];
  const path = pathString.split('.');

  // Check if any path component is uppercase (variant placeholder)
  const variantIndex = path.findIndex((part) => isUpperCase(part));
  const hasVariant = variantIndex !== -1;

  return {
    original,
    path,
    hasVariant,
    variantIndex: hasVariant ? variantIndex : undefined,
  };
}

/**
 * Extract all placeholders from text
 */
export function extractPlaceholders(text: string): PlaceholderInfo[] {
  const placeholders: PlaceholderInfo[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const pathString = match[1];
    const path = pathString.split('.');
    const variantIndex = path.findIndex((part) => isUpperCase(part));
    const hasVariant = variantIndex !== -1;

    placeholders.push({
      original: match[0],
      path,
      hasVariant,
      variantIndex: hasVariant ? variantIndex : undefined,
    });
  }

  return placeholders;
}

/**
 * Replace uppercase component in path with actual variant name
 * Returns new path with variant replaced
 */
export function resolveVariant(path: string[], variantName: string): string[] {
  return path.map((part) => (isUpperCase(part) ? variantName : part));
}

/**
 * Convert path array to dot notation string
 */
export function pathToString(path: string[]): string {
  return path.join('.');
}

/**
 * Resolve placeholder value from config
 * Returns the value at the specified path or undefined if not found
 */
export function resolveFromConfig(
  config: Record<string, unknown>,
  path: string[]
): string | boolean | number | undefined {
  let current: unknown = config;

  for (const part of path) {
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

/**
 * Replace all placeholders in text with values from config
 * Note: Variant placeholders (with uppercase components) must be resolved first
 */
export function replacePlaceholders(
  text: string,
  config: Record<string, unknown>
): string {
  return text.replace(/\{([^}]+)\}/g, (_match, pathString: string) => {
    const path = pathString.split('.');
    const value = resolveFromConfig(config, path);

    if (value === undefined) {
      // Keep placeholder if not found in config
      return `{${pathString}}`;
    }

    return String(value);
  });
}

/**
 * Check if text contains any placeholders
 */
export function hasPlaceholders(text: string): boolean {
  return /\{[^}]+\}/.test(text);
}

/**
 * Get all unique config paths required by placeholders in text
 * Note: Variant placeholders (with uppercase components) must be resolved first
 */
export function getRequiredConfigPaths(text: string): string[] {
  const placeholders = extractPlaceholders(text);
  const paths = new Set<string>();

  for (const placeholder of placeholders) {
    if (!placeholder.hasVariant) {
      paths.add(pathToString(placeholder.path));
    }
  }

  return Array.from(paths);
}
