import { existsSync, rmSync } from 'fs';

/**
 * Safely removes a directory with retry logic and error handling.
 *
 * This utility addresses intermittent ENOTEMPTY errors that can occur when
 * cleaning up test directories, especially on systems where file system
 * operations have timing delays or when processes hold temporary file handles.
 *
 * Usage in tests:
 * ```typescript
 * import { safeRemoveDirectory } from './test-utils';
 *
 * afterEach(() => {
 *   safeRemoveDirectory(tempDir);
 * });
 * ```
 *
 * @param path - The directory path to remove
 * @param maxRetries - Number of retry attempts (default: 3)
 */
export function safeRemoveDirectory(
  path: string,
  maxRetries: number = 3
): void {
  if (!existsSync(path)) {
    return;
  }

  try {
    rmSync(path, { recursive: true, force: true, maxRetries });
  } catch (error) {
    // Ignore cleanup errors - temp directories will be cleaned by OS
    // Log warning for debugging purposes
    console.warn(`Failed to clean up directory ${path}:`, error);
  }
}
