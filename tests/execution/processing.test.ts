import { describe, expect, it } from 'vitest';

import {
  fixEscapedQuotes,
  formatTaskAsYaml,
} from '../../src/execution/processing.js';

describe('Processing', () => {
  describe('fixEscapedQuotes', () => {
    it('adds backslashes before quotes in key="value" pattern', () => {
      const input = 'python3 script.py --arg product="neon"';
      const expected = 'python3 script.py --arg product=\\"neon\\"';
      expect(fixEscapedQuotes(input)).toBe(expected);
    });

    it('handles multiple key="value" patterns in one command', () => {
      const input = 'command --key1="value1" --key2="value2"';
      const expected = 'command --key1=\\"value1\\" --key2=\\"value2\\"';
      expect(fixEscapedQuotes(input)).toBe(expected);
    });

    it('handles empty quoted values', () => {
      const input = 'command --arg=""';
      const expected = 'command --arg=\\"\\"';
      expect(fixEscapedQuotes(input)).toBe(expected);
    });

    it('handles values with spaces', () => {
      const input = 'command --arg="hello world"';
      const expected = 'command --arg=\\"hello world\\"';
      expect(fixEscapedQuotes(input)).toBe(expected);
    });

    it('handles values with special characters', () => {
      const input = 'command --arg="value-with_special.chars"';
      const expected = 'command --arg=\\"value-with_special.chars\\"';
      expect(fixEscapedQuotes(input)).toBe(expected);
    });

    it('does not modify commands without key="value" patterns', () => {
      const input = 'ls -la /home/user';
      expect(fixEscapedQuotes(input)).toBe(input);
    });

    it('does not modify quotes that are not in key="value" pattern', () => {
      const input = 'echo "hello world"';
      expect(fixEscapedQuotes(input)).toBe(input);
    });

    it('handles real-world Opera build command', () => {
      const input =
        'python3 ./desktop/gn_opera.py --release --force product="neon"';
      const expected =
        'python3 ./desktop/gn_opera.py --release --force product=\\"neon\\"';
      expect(fixEscapedQuotes(input)).toBe(expected);
    });

    it('does not double-escape already escaped quotes', () => {
      const input = 'command --arg=\\"value\\"';
      // Already escaped quotes should not be modified
      // The function only targets ="value" pattern, not =\"value\"
      expect(fixEscapedQuotes(input)).toBe(input);
    });
  });

  describe('formatTaskAsYaml', () => {
    it('lowercases first character of action', () => {
      expect(formatTaskAsYaml('Deploy application')).toBe('deploy application');
    });

    it('preserves already lowercase first character', () => {
      expect(formatTaskAsYaml('run tests')).toBe('run tests');
    });

    it('handles single character action', () => {
      expect(formatTaskAsYaml('A')).toBe('a');
    });

    it('handles empty action string', () => {
      expect(formatTaskAsYaml('')).toBe('');
    });

    it('returns action only when metadata is undefined', () => {
      expect(formatTaskAsYaml('Build project', undefined)).toBe(
        'build project'
      );
    });

    it('returns action only when metadata is empty object', () => {
      expect(formatTaskAsYaml('Build project', {})).toBe('build project');
    });

    it('adds YAML metadata block when metadata has properties', () => {
      const result = formatTaskAsYaml('Build project', { env: 'production' });
      expect(result).toBe('build project\n\nmetadata:\n  env: production');
    });

    it('handles multiple metadata properties', () => {
      const result = formatTaskAsYaml('Deploy', {
        env: 'prod',
        version: '1.0',
      });
      expect(result).toBe('deploy\n\nmetadata:\n  env: prod\n  version: "1.0"');
    });

    it('handles nested metadata objects', () => {
      const result = formatTaskAsYaml('Configure', {
        settings: { debug: true },
      });
      expect(result).toBe(
        'configure\n\nmetadata:\n  settings:\n    debug: true'
      );
    });

    it('preserves case in rest of action string', () => {
      const result = formatTaskAsYaml('Process /Users/Dev/MyProject/Data.csv');
      expect(result).toBe('process /Users/Dev/MyProject/Data.csv');
    });

    it('handles boolean metadata values', () => {
      const result = formatTaskAsYaml('Run', { verbose: true, dryRun: false });
      expect(result).toBe('run\n\nmetadata:\n  verbose: true\n  dryRun: false');
    });

    it('handles numeric metadata values', () => {
      const result = formatTaskAsYaml('Retry', { attempts: 3, timeout: 5000 });
      expect(result).toBe('retry\n\nmetadata:\n  attempts: 3\n  timeout: 5000');
    });

    it('indents metadata block when indent parameter provided', () => {
      const result = formatTaskAsYaml('Deploy', { env: 'prod' }, '  ');
      expect(result).toBe('deploy\n\n  metadata:\n    env: prod');
    });

    it('does not indent action when indent parameter provided', () => {
      const result = formatTaskAsYaml('Run tests', undefined, '  ');
      expect(result).toBe('run tests');
    });
  });
});
