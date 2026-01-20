import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionStatus } from '../../../src/services/shell.js';
import { OutputChunk } from '../../../src/types/components.js';

import {
  chunksToRows,
  getLastLines,
  Output,
} from '../../../src/components/views/Output.js';

/**
 * Helper to create chunks from text for testing.
 * Each line becomes a chunk with incrementing timestamps.
 */
function createChunks(
  text: string,
  source: 'stdout' | 'stderr' = 'stdout'
): OutputChunk[] {
  if (!text.trim()) return [];
  return [{ text, timestamp: Date.now(), source }];
}

/**
 * Helper to create interleaved chunks from stdout and stderr.
 */
function createInterleavedChunks(
  stdout: string,
  stderr: string
): OutputChunk[] {
  const chunks: OutputChunk[] = [];
  let timestamp = Date.now();

  if (stdout.trim()) {
    chunks.push({ text: stdout, timestamp: timestamp++, source: 'stdout' });
  }
  if (stderr.trim()) {
    chunks.push({ text: stderr, timestamp: timestamp++, source: 'stderr' });
  }

  return chunks;
}

describe('Output component', () => {
  describe('Basic rendering', () => {
    it('renders output from chunks', () => {
      const chunks = createChunks('Line 1\nLine 2\nLine 3');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
    });

    it('filters out empty lines', () => {
      const chunks = createChunks('Line 1\n\nLine 2\n\n\nLine 3');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
      const lines =
        lastFrame()
          ?.split('\n')
          .filter((l) => l.trim()) || [];
      expect(lines.length).toBe(3);
    });

    it('handles different line endings', () => {
      const chunks = createChunks('Line 1\r\nLine 2\r\nLine 3');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
    });

    it('returns null when chunks are empty', () => {
      const { lastFrame } = render(
        <Output
          chunks={[]}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toBe('');
    });
  });

  describe('Interleaved output', () => {
    it('combines stdout and stderr in timestamp order', () => {
      const chunks = createInterleavedChunks('stdout line\n', 'stderr line\n');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('stdout line');
      expect(lastFrame()).toContain('stderr line');
    });
  });

  describe('Line limits', () => {
    it('shows only last 8 lines when output exceeds limit', () => {
      const lines = Array.from({ length: 12 }, (_, i) => `Output ${i + 1}`);
      const chunks = createChunks(lines.join('\n') + '\n');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      const frame = lastFrame() || '';
      const visibleLines = frame.split('\n').filter((l) => l.trim());

      // Should show exactly 8 lines
      expect(visibleLines.length).toBe(8);

      // Should not show first 4 lines
      expect(frame).not.toMatch(/Output 1\s*$/m);
      expect(frame).not.toMatch(/Output 2\s*$/m);
      expect(frame).not.toMatch(/Output 3\s*$/m);
      expect(frame).not.toMatch(/Output 4\s*$/m);

      // Should show last 8 lines
      expect(frame).toContain('Output 5');
      expect(frame).toContain('Output 12');
    });
  });

  describe('Pre-split line handling', () => {
    it('splits long lines into chunks of maxWidth', () => {
      const longLine = 'A'.repeat(50);
      const result = getLastLines(longLine, 8, 20);

      expect(result.length).toBe(3);
      expect(result[0]).toBe('A'.repeat(20));
      expect(result[1]).toBe('A'.repeat(20));
      expect(result[2]).toBe('A'.repeat(10));
    });

    it('takes last N rows from flattened chunks', () => {
      const shortLines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      const longLine = 'B'.repeat(60);
      const text = [...shortLines, longLine].join('\n');

      const result = getLastLines(text, 4, 20);

      expect(result.length).toBe(4);
      expect(result[0]).toBe('Line 5');
      expect(result[1]).toBe('B'.repeat(20));
      expect(result[2]).toBe('B'.repeat(20));
      expect(result[3]).toBe('B'.repeat(20));
    });

    it('returns last N rows from very long line', () => {
      const hugeLine = 'X'.repeat(200);

      const result = getLastLines(hugeLine, 4, 20);

      expect(result.length).toBe(4);
      expect(result.every((row) => row === 'X'.repeat(20))).toBe(true);
    });
  });

  describe('chunksToRows function', () => {
    it('converts chunks to rows sorted by timestamp', () => {
      const chunks: OutputChunk[] = [
        { text: 'Second\n', timestamp: 2, source: 'stdout' },
        { text: 'First\n', timestamp: 1, source: 'stderr' },
        { text: 'Third\n', timestamp: 3, source: 'stdout' },
      ];

      const rows = chunksToRows(chunks, 8, 75);

      expect(rows[0]).toBe('First');
      expect(rows[1]).toBe('Second');
      expect(rows[2]).toBe('Third');
    });

    it('deduplicates adjacent identical lines', () => {
      const chunks: OutputChunk[] = [
        { text: 'Same\nSame\nDifferent\n', timestamp: 1, source: 'stdout' },
      ];

      const rows = chunksToRows(chunks, 8, 75);

      expect(rows).toEqual(['Same', 'Different']);
    });

    it('returns empty array for empty chunks', () => {
      const rows = chunksToRows([], 8, 75);
      expect(rows).toEqual([]);
    });
  });

  describe('Incomplete line handling', () => {
    it('hides incomplete lines when not finished', () => {
      const chunks = createChunks('Complete line\nIncomplete');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Running}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Complete line');
      expect(lastFrame()).not.toContain('Incomplete');
    });

    it('returns empty when no complete lines exist and not finished', () => {
      const chunks = createChunks('Partial output without newline');
      const { lastFrame } = render(
        <Output
          chunks={chunks}
          status={ExecutionStatus.Running}
          isFinished={false}
        />
      );

      expect(lastFrame()).toBe('');
    });

    describe('delayed incomplete line display', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('hides incomplete lines before 3 seconds', () => {
        const timestamp = 1000;
        vi.setSystemTime(timestamp + 2999);

        const chunks: OutputChunk[] = [
          { text: 'Incomplete without newline', timestamp, source: 'stdout' },
        ];

        const rows = chunksToRows(chunks, 8, 75, false);
        expect(rows).toEqual([]);
      });

      it('shows incomplete lines after 3 seconds', () => {
        const timestamp = 1000;
        vi.setSystemTime(timestamp + 3000);

        const chunks: OutputChunk[] = [
          { text: 'Incomplete without newline', timestamp, source: 'stdout' },
        ];

        const rows = chunksToRows(chunks, 8, 75, false);
        expect(rows).toEqual(['Incomplete without newline']);
      });

      it('shows complete lines before delay, adds incomplete after', () => {
        const timestamp = 1000;
        const chunks: OutputChunk[] = [
          { text: 'Complete\nIncomplete', timestamp, source: 'stdout' },
        ];

        // Before 3 seconds: only complete line
        vi.setSystemTime(timestamp + 1000);
        const rowsBefore = chunksToRows(chunks, 8, 75, false);
        expect(rowsBefore).toEqual(['Complete']);

        // After 3 seconds: both lines shown
        vi.setSystemTime(timestamp + 3000);
        const rowsAfter = chunksToRows(chunks, 8, 75, false);
        expect(rowsAfter).toEqual(['Complete', 'Incomplete']);
      });
    });
  });
});
