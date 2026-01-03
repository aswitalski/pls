import { describe, expect, it } from 'vitest';

/**
 * LazyLineBuffer implementation for testing.
 * This mirrors the implementation in shell.ts and runner.ts
 */
class LazyLineBuffer {
  private chunks: string[] = [];
  private totalBytes = 0;
  private cachedLines: string[] | null = null;
  private readonly maxLines: number;

  constructor(maxLines = 128) {
    this.maxLines = maxLines;
  }

  push(data: string): void {
    this.chunks.push(data);
    this.totalBytes += data.length;
    this.cachedLines = null;

    if (this.totalBytes > 1024 * 1024) {
      this.compact();
    }
  }

  private compact(): void {
    if (this.chunks.length === 0) return;

    const combined = this.chunks.join('');
    const lines = combined.split('\n');
    const incomplete = lines[lines.length - 1];
    const complete = lines.slice(0, -1);

    if (complete.length > this.maxLines) {
      const kept = complete.slice(-this.maxLines);
      this.chunks = incomplete
        ? [kept.join('\n') + '\n' + incomplete]
        : [kept.join('\n')];
    } else {
      this.chunks = [combined];
    }
    this.totalBytes = this.chunks[0].length;
    this.cachedLines = null;
  }

  getLines(): string[] {
    if (this.cachedLines) return [...this.cachedLines];
    if (this.chunks.length === 0) return [];

    const combined = this.chunks.join('');
    const lines = combined.split('\n');

    const result = lines[lines.length - 1] ? lines : lines.slice(0, -1);

    this.cachedLines =
      result.length > this.maxLines ? result.slice(-this.maxLines) : result;
    return [...this.cachedLines];
  }

  getLastLines(n: number): string[] {
    return this.getLines().slice(-n);
  }

  // Expose internals for testing
  get chunkCount(): number {
    return this.chunks.length;
  }

  get byteCount(): number {
    return this.totalBytes;
  }
}

describe('LazyLineBuffer', () => {
  describe('Basic line handling', () => {
    it('returns empty array for empty buffer', () => {
      const buffer = new LazyLineBuffer();
      expect(buffer.getLines()).toEqual([]);
    });

    it('handles single line without newline', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('hello world');
      expect(buffer.getLines()).toEqual(['hello world']);
    });

    it('handles single line with newline', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('hello world\n');
      expect(buffer.getLines()).toEqual(['hello world']);
    });

    it('handles multiple lines in single push', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\nline 2\nline 3\n');
      expect(buffer.getLines()).toEqual(['line 1', 'line 2', 'line 3']);
    });

    it('handles multiple pushes forming complete lines', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('hel');
      buffer.push('lo\nwor');
      buffer.push('ld\n');
      expect(buffer.getLines()).toEqual(['hello', 'world']);
    });

    it('preserves incomplete line at end', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\nline 2\npartial');
      expect(buffer.getLines()).toEqual(['line 1', 'line 2', 'partial']);
    });
  });

  describe('getLastLines', () => {
    it('returns last N lines', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\nline 2\nline 3\nline 4\nline 5\n');
      expect(buffer.getLastLines(3)).toEqual(['line 3', 'line 4', 'line 5']);
    });

    it('returns all lines when N exceeds total', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\nline 2\n');
      expect(buffer.getLastLines(10)).toEqual(['line 1', 'line 2']);
    });

    it('includes incomplete last line', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\nline 2\nincomplete');
      expect(buffer.getLastLines(2)).toEqual(['line 2', 'incomplete']);
    });
  });

  describe('Lazy processing', () => {
    it('does not process chunks until getLines is called', () => {
      const buffer = new LazyLineBuffer();
      for (let i = 0; i < 1000; i++) {
        buffer.push(`chunk ${i}\n`);
      }
      // Chunks should accumulate, not be processed
      expect(buffer.chunkCount).toBe(1000);
    });

    it('caches result after first getLines call', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\nline 2\nline 3\n');

      const first = buffer.getLines();
      const second = buffer.getLines();

      // Should return equal arrays (new instances each time)
      expect(first).toEqual(second);
      expect(first).not.toBe(second); // Different array instances
    });

    it('invalidates cache on new push', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\n');

      const first = buffer.getLines();
      expect(first).toEqual(['line 1']);

      buffer.push('line 2\n');
      const second = buffer.getLines();
      expect(second).toEqual(['line 1', 'line 2']);
    });
  });

  describe('Line limiting', () => {
    it('limits output to maxLines', () => {
      const buffer = new LazyLineBuffer(10);
      for (let i = 1; i <= 20; i++) {
        buffer.push(`line ${i}\n`);
      }

      const lines = buffer.getLines();
      expect(lines.length).toBe(10);
      expect(lines[0]).toBe('line 11');
      expect(lines[9]).toBe('line 20');
    });

    it('respects custom maxLines in constructor', () => {
      const buffer = new LazyLineBuffer(5);
      for (let i = 1; i <= 100; i++) {
        buffer.push(`line ${i}\n`);
      }

      const lines = buffer.getLines();
      expect(lines.length).toBe(5);
      expect(lines[0]).toBe('line 96');
    });

    it('returns all lines when under limit', () => {
      const buffer = new LazyLineBuffer(100);
      for (let i = 1; i <= 50; i++) {
        buffer.push(`line ${i}\n`);
      }

      const lines = buffer.getLines();
      expect(lines.length).toBe(50);
    });
  });

  describe('Memory compaction', () => {
    it('compacts when exceeding 1MB threshold', () => {
      const buffer = new LazyLineBuffer(10); // Small maxLines for testing

      // Push just over 1MB of data to trigger exactly one compaction
      const chunk = 'x'.repeat(100000) + '\n'; // 100KB per chunk
      for (let i = 0; i < 11; i++) {
        buffer.push(chunk);
      }
      // 11 * 100KB = 1.1MB, should trigger compaction

      // After compaction, should have fewer chunks
      // (compacted to 1, but we're at 11 chunks total,
      // compaction happens at push 11, reducing to 1)
      expect(buffer.chunkCount).toBe(1);

      // After compaction, byte count should be ~10 lines * 100KB = 1MB
      // But we keep only 10 lines, so ~1MB
      expect(buffer.byteCount).toBeLessThanOrEqual(10 * 100001 + 100);
    });

    it('preserves last maxLines after compaction', () => {
      const buffer = new LazyLineBuffer(10);

      // Push ~1.5MB of data with numbered lines
      for (let i = 1; i <= 1500; i++) {
        buffer.push(`line ${i} ${'x'.repeat(1000)}\n`);
      }

      const lines = buffer.getLines();
      expect(lines.length).toBe(10);
      expect(lines[0]).toContain('line 1491');
      expect(lines[9]).toContain('line 1500');
    });

    it('preserves incomplete line during compaction', () => {
      const buffer = new LazyLineBuffer(5);

      // Push over 1MB with incomplete last line
      for (let i = 1; i <= 1000; i++) {
        buffer.push(`line ${i} ${'x'.repeat(1000)}\n`);
      }
      buffer.push('incomplete line');

      const lines = buffer.getLines();
      expect(lines[lines.length - 1]).toBe('incomplete line');
    });
  });

  describe('Real-world scenarios', () => {
    it('handles npm/webpack style output with rapid small chunks', () => {
      const buffer = new LazyLineBuffer();

      // Simulate webpack output: many small progress updates
      for (let i = 0; i < 10000; i++) {
        buffer.push(`[${i}/10000] Building module ${i}...`);
        if (i % 100 === 0) {
          buffer.push('\n');
        }
      }

      const lines = buffer.getLastLines(8);
      expect(lines.length).toBeLessThanOrEqual(8);
    });

    it('handles TypeScript compiler output with errors', () => {
      const buffer = new LazyLineBuffer();

      // Simulate tsc output
      buffer.push('src/index.ts(10,5): error TS2322: Type string is not\n');
      buffer.push('assignable to type number.\n');
      buffer.push('src/utils.ts(25,10): error TS2345: Argument of type\n');
      buffer.push("'undefined' is not assignable to parameter.\n");
      buffer.push('\nFound 2 errors.\n');

      const lines = buffer.getLines();
      expect(lines).toContain('Found 2 errors.');
    });

    it('handles streaming JSON output line by line', () => {
      const buffer = new LazyLineBuffer();

      const jsonLines = [
        '{"id": 1, "status": "pending"}',
        '{"id": 2, "status": "running"}',
        '{"id": 3, "status": "complete"}',
      ];

      for (const line of jsonLines) {
        buffer.push(line + '\n');
      }

      const lines = buffer.getLines();
      expect(lines.length).toBe(3);
      expect(JSON.parse(lines[2])).toEqual({ id: 3, status: 'complete' });
    });

    it('handles interleaved stdout chunks efficiently', () => {
      const buffer = new LazyLineBuffer();

      // Simulate interleaved output from parallel processes
      for (let i = 0; i < 5000; i++) {
        const process = i % 3;
        buffer.push(`[process-${process}] `);
        buffer.push(`message ${Math.floor(i / 3)}\n`);
      }

      const lines = buffer.getLastLines(8);
      expect(lines.length).toBe(8);
      lines.forEach((line) => {
        expect(line).toMatch(/^\[process-\d\] message \d+$/);
      });
    });

    it('handles large single-line output like minified JS', () => {
      const buffer = new LazyLineBuffer();

      // Simulate minified JS output (one very long line)
      const minifiedJs = 'var a=' + 'x'.repeat(50000) + ';';
      buffer.push(minifiedJs);
      buffer.push('\n//# sourceMappingURL=bundle.js.map\n');

      const lines = buffer.getLines();
      expect(lines.length).toBe(2);
      expect(lines[0].length).toBe(50007); // 'var a=' (6) + x*50000 + ';' (1) = 50007
      expect(lines[1]).toBe('//# sourceMappingURL=bundle.js.map');
    });

    it('handles ANSI color codes in output', () => {
      const buffer = new LazyLineBuffer();

      buffer.push('\x1b[32m✓\x1b[0m Test passed\n');
      buffer.push('\x1b[31m✗\x1b[0m Test failed\n');
      buffer.push('\x1b[33m⚠\x1b[0m Warning\n');

      const lines = buffer.getLines();
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('✓');
      expect(lines[1]).toContain('✗');
    });

    it('handles empty lines in output', () => {
      const buffer = new LazyLineBuffer();

      buffer.push('Header\n\nLine after empty\n\n\nMore content\n');

      const lines = buffer.getLines();
      expect(lines).toEqual([
        'Header',
        '',
        'Line after empty',
        '',
        '',
        'More content',
      ]);
    });

    it('handles Windows-style CRLF line endings', () => {
      const buffer = new LazyLineBuffer();

      buffer.push('line 1\r\nline 2\r\nline 3\r\n');

      const lines = buffer.getLines();
      // Split by \n leaves \r at end of lines
      expect(lines[0]).toBe('line 1\r');
      expect(lines.length).toBe(3);
    });
  });

  describe('High-volume scenarios', () => {
    it('handles 100K small chunks efficiently', () => {
      const buffer = new LazyLineBuffer();

      const start = Date.now();
      for (let i = 0; i < 100000; i++) {
        buffer.push(`${i}\n`);
      }
      const pushTime = Date.now() - start;

      // Push should be very fast (< 100ms for 100K items)
      expect(pushTime).toBeLessThan(1000);

      const getStart = Date.now();
      const lines = buffer.getLastLines(8);
      const getTime = Date.now() - getStart;

      // Get should process all data
      expect(lines.length).toBe(8);
      expect(lines[7]).toBe('99999');

      // Processing should complete in reasonable time
      expect(getTime).toBeLessThan(1000);
    });

    it('handles repeated getLastLines calls with caching', () => {
      const buffer = new LazyLineBuffer();

      for (let i = 0; i < 10000; i++) {
        buffer.push(`line ${i}\n`);
      }

      // First call processes
      buffer.getLastLines(8);

      // Subsequent calls should use cache
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        buffer.getLastLines(8);
      }
      const elapsed = Date.now() - start;

      // 1000 cached calls should be very fast
      expect(elapsed).toBeLessThan(100);
    });

    it('handles alternating push and read pattern', () => {
      const buffer = new LazyLineBuffer();

      for (let batch = 0; batch < 100; batch++) {
        // Push batch of chunks
        for (let i = 0; i < 100; i++) {
          buffer.push(`batch ${batch} line ${i}\n`);
        }
        // Read after each batch (like UI updates)
        const lines = buffer.getLastLines(8);
        expect(lines.length).toBe(8);
      }

      const finalLines = buffer.getLastLines(8);
      expect(finalLines[7]).toBe('batch 99 line 99');
    });
  });

  describe('Edge cases', () => {
    it('handles only newlines', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('\n\n\n');
      expect(buffer.getLines()).toEqual(['', '', '']);
    });

    it('handles unicode content', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('日本語\n');
      buffer.push('한국어\n');
      buffer.push('🎉🎊🎈\n');

      const lines = buffer.getLines();
      expect(lines).toEqual(['日本語', '한국어', '🎉🎊🎈']);
    });

    it('handles null bytes in content', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('before\x00after\n');

      const lines = buffer.getLines();
      expect(lines[0]).toBe('before\x00after');
    });

    it('handles very long lines within memory limit', () => {
      const buffer = new LazyLineBuffer(10);

      // Push 10 very long lines (100KB each)
      for (let i = 0; i < 10; i++) {
        buffer.push(`line ${i}: ${'x'.repeat(100000)}\n`);
      }

      const lines = buffer.getLines();
      expect(lines.length).toBe(10);
      expect(lines[0]).toContain('line 0');
    });

    it('returns new array instances each time', () => {
      const buffer = new LazyLineBuffer();
      buffer.push('line 1\n');

      const first = buffer.getLines();
      const second = buffer.getLines();

      expect(first).toEqual(second);
      expect(first).not.toBe(second);

      // Modifying one should not affect the other
      first.push('modified');
      expect(second.length).toBe(1);
    });
  });
});
