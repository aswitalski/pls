/**
 * Timing utilities for UI components
 */

/**
 * Waits for at least the minimum processing time.
 * Ensures async operations don't complete too quickly for good UX.
 *
 * @param startTime - The timestamp when the operation started
 * @param minimumTime - The minimum total time the operation should take
 */
export async function ensureMinimumTime(
  startTime: number,
  minimumTime: number
): Promise<void> {
  const elapsed = Date.now() - startTime;
  const remainingTime = Math.max(0, minimumTime - elapsed);

  if (remainingTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingTime));
  }
}

/**
 * Wraps an async operation with minimum processing time UX polish.
 * Ensures successful operations take at least `minimumTime` milliseconds.
 * Errors are thrown immediately without delay for better UX.
 *
 * @param operation - The async operation to perform
 * @param minimumTime - Minimum time in milliseconds for UX polish on success
 * @returns The result of the operation
 */
export async function withMinimumTime<T>(
  operation: () => Promise<T>,
  minimumTime: number
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await operation();
    await ensureMinimumTime(startTime, minimumTime);
    return result;
  } catch (error) {
    // Don't wait on error - fail fast for better UX
    throw error;
  }
}
