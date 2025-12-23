import { describe, expect, it } from 'vitest';

import { formatDuration } from '../../src/services/utils.js';

describe('Formatting duration', () => {
  it('formats seconds only for durations under 60 seconds', () => {
    expect(formatDuration(1000)).toBe('1 second');
    expect(formatDuration(5000)).toBe('5 seconds');
    expect(formatDuration(30000)).toBe('30 seconds');
    expect(formatDuration(59000)).toBe('59 seconds');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(61000)).toBe('1 minute 1 second');
    expect(formatDuration(65000)).toBe('1 minute 5 seconds');
    expect(formatDuration(125000)).toBe('2 minutes 5 seconds');
    expect(formatDuration(185000)).toBe('3 minutes 5 seconds');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3661000)).toBe('1 hour 1 minute 1 second');
    expect(formatDuration(3665000)).toBe('1 hour 1 minute 5 seconds');
    expect(formatDuration(7325000)).toBe('2 hours 2 minutes 5 seconds');
  });

  it('formats hours and seconds without minutes', () => {
    expect(formatDuration(3601000)).toBe('1 hour 1 second');
    expect(formatDuration(3605000)).toBe('1 hour 5 seconds');
    expect(formatDuration(7205000)).toBe('2 hours 5 seconds');
  });

  it('formats hours only', () => {
    expect(formatDuration(3600000)).toBe('1 hour');
    expect(formatDuration(7200000)).toBe('2 hours');
    expect(formatDuration(10800000)).toBe('3 hours');
  });

  it('handles zero duration', () => {
    expect(formatDuration(0)).toBe('0 seconds');
  });

  it('handles edge case at 3599 seconds', () => {
    expect(formatDuration(3599000)).toBe('59 minutes 59 seconds');
  });

  it('formats complex durations', () => {
    expect(formatDuration(90061000)).toBe('25 hours 1 minute 1 second');
    expect(formatDuration(86400000)).toBe('24 hours');
    expect(formatDuration(86461000)).toBe('24 hours 1 minute 1 second');
  });
});
