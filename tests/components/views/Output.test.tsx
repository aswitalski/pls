import { render } from 'ink-testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionStatus } from '../../../src/services/shell.js';
import { OutputChunk, OutputSource } from '../../../src/types/components.js';

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
  source: OutputSource = OutputSource.Stdout
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
    chunks.push({
      text: stdout,
      timestamp: timestamp++,
      source: OutputSource.Stdout,
    });
  }
  if (stderr.trim()) {
    chunks.push({
      text: stderr,
      timestamp: timestamp++,
      source: OutputSource.Stderr,
    });
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
        { text: 'Second\n', timestamp: 2, source: OutputSource.Stdout },
        { text: 'First\n', timestamp: 1, source: OutputSource.Stderr },
        { text: 'Third\n', timestamp: 3, source: OutputSource.Stdout },
      ];

      const rows = chunksToRows(chunks, 8, 75);

      expect(rows[0]).toBe('First');
      expect(rows[1]).toBe('Second');
      expect(rows[2]).toBe('Third');
    });

    it('deduplicates adjacent identical lines', () => {
      const chunks: OutputChunk[] = [
        {
          text: 'Same\nSame\nDifferent\n',
          timestamp: 1,
          source: OutputSource.Stdout,
        },
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
          {
            text: 'Incomplete without newline',
            timestamp,
            source: OutputSource.Stdout,
          },
        ];

        const rows = chunksToRows(chunks, 8, 75, false);
        expect(rows).toEqual([]);
      });

      it('shows incomplete lines after 3 seconds', () => {
        const timestamp = 1000;
        vi.setSystemTime(timestamp + 3000);

        const chunks: OutputChunk[] = [
          {
            text: 'Incomplete without newline',
            timestamp,
            source: OutputSource.Stdout,
          },
        ];

        const rows = chunksToRows(chunks, 8, 75, false);
        expect(rows).toEqual(['Incomplete without newline']);
      });

      it('shows complete lines before delay, adds incomplete after', () => {
        const timestamp = 1000;
        const chunks: OutputChunk[] = [
          {
            text: 'Complete\nIncomplete',
            timestamp,
            source: OutputSource.Stdout,
          },
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

  describe('Stdin insertion', () => {
    it('inserts stdin after last complete line during build output', () => {
      // Simulates: build outputs partial line, user sends stdin, build continues
      const chunks: OutputChunk[] = [
        {
          text: '[1/100] CXX obj/browser/ui/sidebar.o\n[2/100] CXX obj/browser/ui/side',
          timestamp: 1000,
          source: OutputSource.Stdout,
        },
        {
          text: '\n> test\n',
          timestamp: 1500,
          source: OutputSource.Stdin,
        },
        {
          text: 'bar_button.o\n[3/100] CXX obj/browser/ui/panel.o\n',
          timestamp: 2000,
          source: OutputSource.Stdout,
        },
      ];

      const rows = chunksToRows(chunks, 8, 75, true);

      // Stdin should appear after line 1, not in the middle of "sidebar_button"
      expect(rows).toEqual([
        '[1/100] CXX obj/browser/ui/sidebar.o',
        '> test',
        '[2/100] CXX obj/browser/ui/sidebar_button.o',
        '[3/100] CXX obj/browser/ui/panel.o',
      ]);
    });

    it('handles stdin when output arrives in small chunks', () => {
      // Real scenario: streaming output arrives character by character
      const chunks: OutputChunk[] = [
        {
          text: 'Installing packages',
          timestamp: 100,
          source: OutputSource.Stdout,
        },
        { text: '...\n', timestamp: 200, source: OutputSource.Stdout },
        {
          text: 'npm WARN deprecated\n',
          timestamp: 300,
          source: OutputSource.Stdout,
        },
        { text: '\n> y\n', timestamp: 350, source: OutputSource.Stdin },
        {
          text: 'added 150 packages\n',
          timestamp: 400,
          source: OutputSource.Stdout,
        },
      ];

      const rows = chunksToRows(chunks, 8, 75, true);

      expect(rows).toEqual([
        'Installing packages...',
        'npm WARN deprecated',
        '> y',
        'added 150 packages',
      ]);
    });

    it('places stdin at start when no complete lines exist yet', () => {
      const chunks: OutputChunk[] = [
        { text: 'Loading', timestamp: 100, source: OutputSource.Stdout },
        { text: '\n> input\n', timestamp: 150, source: OutputSource.Stdin },
        { text: '...\nDone\n', timestamp: 200, source: OutputSource.Stdout },
      ];

      const rows = chunksToRows(chunks, 8, 75, true);

      // Stdin should appear at start since no newline existed before it
      expect(rows).toEqual(['> input', 'Loading...', 'Done']);
    });

    it('handles multiple stdin entries during execution', () => {
      const chunks: OutputChunk[] = [
        {
          text: 'Step 1 complete\n',
          timestamp: 100,
          source: OutputSource.Stdout,
        },
        { text: '\n> first\n', timestamp: 150, source: OutputSource.Stdin },
        {
          text: 'Step 2 complete\n',
          timestamp: 200,
          source: OutputSource.Stdout,
        },
        { text: '\n> second\n', timestamp: 250, source: OutputSource.Stdin },
        {
          text: 'Step 3 complete\n',
          timestamp: 300,
          source: OutputSource.Stdout,
        },
      ];

      const rows = chunksToRows(chunks, 8, 75, true);

      expect(rows).toEqual([
        'Step 1 complete',
        '> first',
        'Step 2 complete',
        '> second',
        'Step 3 complete',
      ]);
    });

    it('preserves stdin position when output has no trailing newline', () => {
      // Build output often ends mid-line
      const chunks: OutputChunk[] = [
        {
          text: '[50/100] Compiling file.o\n[51/100] Compiling next',
          timestamp: 100,
          source: OutputSource.Stdout,
        },
        { text: '\n> status\n', timestamp: 150, source: OutputSource.Stdin },
      ];

      const rows = chunksToRows(chunks, 8, 75, true);

      expect(rows).toEqual([
        '[50/100] Compiling file.o',
        '> status',
        '[51/100] Compiling next',
      ]);
    });
  });
});
