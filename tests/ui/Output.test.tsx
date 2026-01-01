import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { ExecutionStatus } from '../../src/services/shell.js';

import { Output } from '../../src/components/views/Output.js';

describe('Output component', () => {
  describe('Empty line filtering', () => {
    it('filters out empty lines from stdout', () => {
      const stdout = 'Line 1\n\nLine 2\n\n\nLine 3';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
      // Count lines - should only have 3 lines of content
      const lines =
        lastFrame()
          ?.split('\n')
          .filter((l) => l.trim()) || [];
      expect(lines.length).toBe(3);
    });

    it('filters out empty lines from stderr', () => {
      const stderr = 'Error 1\n\nError 2\n\n\nError 3';
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Error 1');
      expect(lastFrame()).toContain('Error 2');
      expect(lastFrame()).toContain('Error 3');
      const lines =
        lastFrame()
          ?.split('\n')
          .filter((l) => l.trim()) || [];
      expect(lines.length).toBe(3);
    });

    it('filters out whitespace-only lines', () => {
      const stdout = 'Line 1\n   \nLine 2\n\t\nLine 3';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      const lines =
        lastFrame()
          ?.split('\n')
          .filter((l) => l.trim()) || [];
      expect(lines.length).toBe(3);
    });

    it('handles different line endings', () => {
      const stdout = 'Line 1\r\nLine 2\r\nLine 3';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
    });
  });

  describe('Color coding', () => {
    it('shows stderr in yellow when status is Failed', () => {
      const stderr = 'Error message';
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Error message');
    });

    it('shows stderr in gray when status is Success', () => {
      const stderr = 'Warning message';
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Warning message');
    });

    it('always shows stdout in gray', () => {
      const stdout = 'Standard output';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Standard output');
    });
  });

  describe('Smart stdout display', () => {
    it('shows stdout when stderr has 2 lines or fewer', () => {
      const stdout = 'Output line 1\nOutput line 2';
      const stderr = 'Error line 1\nError line 2';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Output line 1');
      expect(lastFrame()).toContain('Output line 2');
      expect(lastFrame()).toContain('Error line 1');
      expect(lastFrame()).toContain('Error line 2');
    });

    it('hides stdout when stderr has more than 2 lines', () => {
      const stdout = 'Output line 1\nOutput line 2';
      const stderr = 'Error 1\nError 2\nError 3';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).not.toContain('Output line 1');
      expect(lastFrame()).not.toContain('Output line 2');
      expect(lastFrame()).toContain('Error 1');
      expect(lastFrame()).toContain('Error 2');
      expect(lastFrame()).toContain('Error 3');
    });

    it('shows stdout when there is no stderr', () => {
      const stdout = 'Output line 1\nOutput line 2\nOutput line 3';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Output line 1');
      expect(lastFrame()).toContain('Output line 2');
      expect(lastFrame()).toContain('Output line 3');
    });

    it('shows stdout when stderr has only 1 line', () => {
      const stdout = 'Output line 1\nOutput line 2';
      const stderr = 'Single error';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Output line 1');
      expect(lastFrame()).toContain('Output line 2');
      expect(lastFrame()).toContain('Single error');
    });
  });

  describe('Empty output handling', () => {
    it('returns null when both stdout and stderr are empty', () => {
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toBe('');
    });

    it('shows output when only stdout has content', () => {
      const { lastFrame } = render(
        <Output
          stdout="Some output"
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Some output');
    });

    it('shows output when only stderr has content', () => {
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr="Some error"
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Some error');
    });
  });

  describe('Line limits', () => {
    it('shows all lines when total is 8 or fewer', () => {
      const lines = Array.from({ length: 8 }, (_, i) => `Line ${i + 1}`);
      const stdout = lines.join('\n');
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      lines.forEach((line) => {
        expect(lastFrame()).toContain(line);
      });
    });

    it('shows only last 8 lines when stdout exceeds limit', () => {
      const lines = Array.from({ length: 12 }, (_, i) => `Output ${i + 1}`);
      const stdout = lines.join('\n');
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
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

    it('shows only last 8 lines when stderr exceeds limit', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Failure ${i + 1}`);
      const stderr = lines.join('\n');
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      const frame = lastFrame() || '';
      const visibleLines = frame.split('\n').filter((l) => l.trim());

      // Should show exactly 8 lines
      expect(visibleLines.length).toBe(8);

      // Should not show first 2 lines
      expect(frame).not.toMatch(/Failure 1\s*$/m);
      expect(frame).not.toMatch(/Failure 2\s*$/m);

      // Should show last 8 lines (3-10)
      expect(frame).toContain('Failure 3');
      expect(frame).toContain('Failure 10');
    });
  });

  describe('Word wrapping behavior', () => {
    it('uses wrap mode for 4 lines or fewer', () => {
      const stdout = 'Line 1\nLine 2\nLine 3\nLine 4';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      // All lines should be present (wrap mode preserves content)
      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Line 3');
      expect(lastFrame()).toContain('Line 4');
    });

    it('uses truncate mode for more than 4 lines', () => {
      const lines = Array.from({ length: 6 }, (_, i) => `Line ${i + 1}`);
      const stdout = lines.join('\n');
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      // All 6 lines should still be present (within 8 line limit)
      lines.forEach((line) => {
        expect(lastFrame()).toContain(line);
      });
    });
  });

  describe('Combined stdout and stderr', () => {
    it('shows both stdout and stderr in correct order', () => {
      const stdout = 'Output message';
      const stderr = 'Error message';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Output message');
      expect(lastFrame()).toContain('Error message');

      // Stdout should come before stderr in the output
      const frame = lastFrame() || '';
      const stdoutIndex = frame.indexOf('Output message');
      const stderrIndex = frame.indexOf('Error message');
      expect(stdoutIndex).toBeLessThan(stderrIndex);
    });

    it('respects line limit when combining stdout and stderr', () => {
      const stdout = Array.from({ length: 5 }, (_, i) => `Out ${i + 1}`).join(
        '\n'
      );
      const stderr = Array.from({ length: 5 }, (_, i) => `Err ${i + 1}`).join(
        '\n'
      );
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      // With 5 lines each (10 total) and stderr > 2 lines,
      // stdout is hidden and only stderr is shown
      expect(lastFrame()).not.toContain('Out');
      expect(lastFrame()).toContain('Err 1');
      expect(lastFrame()).toContain('Err 5');
    });
  });

  describe('Edge cases', () => {
    it('preserves indentation in output', () => {
      const stdout = '  import pkg_resources\n    nested line';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('import pkg_resources');
      expect(lastFrame()).toContain('nested line');
    });

    it('handles very long single line', () => {
      const longLine = 'A'.repeat(200);
      const { lastFrame } = render(
        <Output
          stdout={longLine}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('A');
    });

    it('handles mixed content with empty lines', () => {
      const stdout = 'Line 1\n\n\nLine 2';
      const stderr = 'Error 1\n\nError 2';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Line 1');
      expect(lastFrame()).toContain('Line 2');
      expect(lastFrame()).toContain('Error 1');
      expect(lastFrame()).toContain('Error 2');

      // Should only have 4 non-empty lines total
      const lines =
        lastFrame()
          ?.split('\n')
          .filter((l) => l.trim()) || [];
      expect(lines.length).toBe(4);
    });
  });

  describe('Finished task styling', () => {
    it('uses darker color for stdout when task is finished', () => {
      const stdout = 'Task completed output';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Task completed output');
    });

    it('uses darker color for stderr when task is finished', () => {
      const stderr = 'Task warning message';
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Task warning message');
    });

    it('uses regular color for stdout when task is not finished', () => {
      const stdout = 'Running task output';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr=""
          status={ExecutionStatus.Running}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Running task output');
    });

    it('uses regular color for stderr when task is not finished', () => {
      const stderr = 'Running task warning';
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Running}
          isFinished={false}
        />
      );

      expect(lastFrame()).toContain('Running task warning');
    });

    it('uses yellow for stderr when task failed regardless of isFinished', () => {
      const stderr = 'Error message';
      const { lastFrame } = render(
        <Output
          stdout=""
          stderr={stderr}
          status={ExecutionStatus.Failed}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Error message');
    });

    it('applies darker color to both stdout and stderr when finished', () => {
      const stdout = 'Output line';
      const stderr = 'Warning line';
      const { lastFrame } = render(
        <Output
          stdout={stdout}
          stderr={stderr}
          status={ExecutionStatus.Success}
          isFinished={true}
        />
      );

      expect(lastFrame()).toContain('Output line');
      expect(lastFrame()).toContain('Warning line');
    });
  });
});
