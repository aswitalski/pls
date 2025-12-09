import { PlaceholderInfo } from '../types/skills.js';
import { loadDebugSetting } from './configuration.js';

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
  const debug = loadDebugSetting();

  if (debug) {
    console.log(`  → Looking up config path: ${path.join('.')}`);
  }

  let current: unknown = config;

  for (const part of path) {
    if (current === null || current === undefined) {
      if (debug) {
        console.log(`  → Path not found (null/undefined at "${part}")`);
      }
      return undefined;
    }

    if (typeof current !== 'object') {
      if (debug) {
        console.log(`  → Path not found (not an object at "${part}")`);
      }
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  if (
    typeof current === 'string' ||
    typeof current === 'boolean' ||
    typeof current === 'number'
  ) {
    if (debug) {
      console.log(`  → Resolved to: ${String(current)}`);
    }
    return current;
  }

  if (debug) {
    console.log(`  → Path not found (invalid type at end)`);
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
  const debug = loadDebugSetting();

  if (debug) {
    console.log('\n=== PLACEHOLDER RESOLUTION ===');
    console.log(`Original text: ${text}`);
    console.log(`\n→ Searching for placeholders using regex: /\\{([^}]+)\\}/g`);
  }

  // Find all placeholders first
  const regex = /\{([^}]+)\}/g;
  const matches = [...text.matchAll(regex)];

  if (debug) {
    console.log(`→ Found ${matches.length} placeholder(s) in text`);
    if (matches.length > 0) {
      console.log(`→ Placeholders: ${matches.map((m) => m[0]).join(', ')}`);
    }
  }

  const result = text.replace(regex, (_match, pathString: string) => {
    if (debug) {
      console.log(`\n→ Processing placeholder: {${pathString}}`);
    }

    const path = pathString.split('.');

    if (debug) {
      console.log(`  → Split into path components: [${path.join(', ')}]`);

      // Check if any component is uppercase (variant placeholder)
      const variantIndex = path.findIndex(
        (part) => part === part.toUpperCase() && part !== part.toLowerCase()
      );
      if (variantIndex !== -1) {
        console.log(
          `  → Contains variant placeholder at index ${variantIndex}: ${path[variantIndex]}`
        );
        console.log(
          `  → WARNING: Variant should have been resolved in PLAN phase`
        );
      }
    }

    const value = resolveFromConfig(config, path);

    if (value === undefined) {
      if (debug) {
        console.log(`  → ❌ Config value NOT found - keeping placeholder`);
        console.log(`  → This indicates missing configuration`);
      }
      // Keep placeholder if not found in config
      return `{${pathString}}`;
    }

    if (debug) {
      console.log(`  → ✓ Substitution: {${pathString}} → ${String(value)}`);
    }

    return String(value);
  });

  if (debug) {
    const hasUnresolvedPlaceholders = /\{[^}]+\}/.test(result);
    console.log(`\n→ Final result: ${result}`);
    if (hasUnresolvedPlaceholders) {
      console.log(
        `→ ⚠️  WARNING: Result still contains placeholders (missing config)`
      );
    } else {
      console.log(`→ ✓ All placeholders resolved successfully`);
    }
    console.log('==============================\n');
  }

  return result;
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
