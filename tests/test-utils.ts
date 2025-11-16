import { existsSync, rmSync } from 'fs';

import type { Capability } from '../src/types/components.js';
import type { Task } from '../src/types/types.js';

import type { LLMService } from '../src/services/anthropic.js';

/**
 * Test input key constants for stdin.write()
 *
 * These constants represent ANSI escape sequences and special keys
 * used in terminal interactions during testing.
 */
export const Keys = {
  Enter: '\r',
  Tab: '\t',
  Escape: '\x1B',
  ArrowUp: '\x1B[A',
  ArrowDown: '\x1B[B',
  ArrowLeft: '\x1B[D',
  ArrowRight: '\x1B[C',
} as const;

/**
 * Creates a mock LLM service for testing.
 *
 * @param result - The result to return from processWithTool
 * @param error - Optional error to throw instead of returning result
 * @returns A mock LLMService instance
 */
export function createMockAnthropicService(
  result: {
    message?: string;
    tasks?: Task[];
    capabilities?: Capability[];
    answer?: string;
  },
  error?: Error
): LLMService {
  return {
    processWithTool: () => {
      if (error) {
        return Promise.reject(error);
      }
      return Promise.resolve({
        message: result.message || '',
        tasks: result.tasks || [],
        answer: result.answer,
      });
    },
  };
}

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
