import type { AppError } from './errors.js';

/**
 * Result type for operations that can fail predictably
 * Provides explicit error handling without exceptions
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Create a successful result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Unwrap a result, throwing if it's an error
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}

/**
 * Map the value of a successful result
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

/**
 * Check if a result is successful
 */
export function isOk<T, E>(
  result: Result<T, E>
): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Check if a result is an error
 */
export function isErr<T, E>(
  result: Result<T, E>
): result is { ok: false; error: E } {
  return !result.ok;
}
