import { performance } from 'perf_hooks';

/**
 * Prevent perf_hooks memory leak warning during long-running operations.
 * React and Ink create performance measurements internally that accumulate
 * in the global buffer. This clears them immediately and periodically.
 */
export function preventPerformanceBufferOverflow(intervalMs = 60000): void {
  performance.clearMarks();
  performance.clearMeasures();

  setInterval(() => {
    performance.clearMarks();
    performance.clearMeasures();
  }, intervalMs).unref();
}
