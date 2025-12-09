import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ensureMinimumTime,
  withMinimumTime,
} from '../../src/services/timing.js';

describe('Ensuring minimum time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waits remaining time when operation completes early', async () => {
    const startTime = Date.now();
    const minimumTime = 1000;

    // Simulate 300ms elapsed
    vi.advanceTimersByTime(300);

    const promise = ensureMinimumTime(startTime, minimumTime);

    // Fast-forward through the remaining time (700ms)
    await vi.advanceTimersByTimeAsync(700);

    await promise;
  });

  it('does not wait when minimum time already elapsed', async () => {
    const startTime = Date.now();
    const minimumTime = 1000;

    // Simulate 1200ms elapsed (more than minimum)
    vi.advanceTimersByTime(1200);

    const promise = ensureMinimumTime(startTime, minimumTime);

    // Should resolve immediately without additional waiting
    await promise;
  });

  it('handles zero minimum time', async () => {
    const startTime = Date.now();
    const minimumTime = 0;

    const promise = ensureMinimumTime(startTime, minimumTime);

    // Should resolve immediately
    await promise;
  });

  it('calculates remaining time correctly', async () => {
    const startTime = Date.now();
    const minimumTime = 2000;

    // Simulate 500ms elapsed
    vi.advanceTimersByTime(500);

    const promise = ensureMinimumTime(startTime, minimumTime);

    // Should wait for remaining 1500ms
    await vi.advanceTimersByTimeAsync(1500);

    await promise;
  });
});

describe('Wrapping operation with minimum time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waits for minimum time on successful operation', async () => {
    const operation = vi.fn(() => {
      // Simulate quick operation (100ms)
      vi.advanceTimersByTime(100);
      return Promise.resolve('success');
    });

    const promise = withMinimumTime(operation, 1000);

    // Wait for operation to complete
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('returns operation result correctly', async () => {
    const operation = vi.fn(() => {
      return Promise.resolve({ data: 'test', count: 42 });
    });

    const promise = withMinimumTime(operation, 500);

    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toEqual({ data: 'test', count: 42 });
  });

  it('throws error immediately without waiting on failure', async () => {
    const operation = vi.fn(() => {
      // Simulate some processing time before error
      vi.advanceTimersByTime(50);
      return Promise.reject(new Error('Operation failed'));
    });

    const promise = withMinimumTime(operation, 1000);

    // The error should be thrown immediately without waiting for minimum time
    await expect(promise).rejects.toThrow('Operation failed');
  });

  it('works with different return types', async () => {
    const stringOp = vi.fn(() => Promise.resolve('string result'));
    const numberOp = vi.fn(() => Promise.resolve(123));
    const boolOp = vi.fn(() => Promise.resolve(true));
    const arrayOp = vi.fn(() => Promise.resolve([1, 2, 3]));

    const stringPromise = withMinimumTime(stringOp, 100);
    await vi.runAllTimersAsync();
    expect(await stringPromise).toBe('string result');

    vi.clearAllTimers();

    const numberPromise = withMinimumTime(numberOp, 100);
    await vi.runAllTimersAsync();
    expect(await numberPromise).toBe(123);

    vi.clearAllTimers();

    const boolPromise = withMinimumTime(boolOp, 100);
    await vi.runAllTimersAsync();
    expect(await boolPromise).toBe(true);

    vi.clearAllTimers();

    const arrayPromise = withMinimumTime(arrayOp, 100);
    await vi.runAllTimersAsync();
    expect(await arrayPromise).toEqual([1, 2, 3]);
  });
});
