import { describe, expect, it } from 'vitest';

import { fixEscapedQuotes } from '../../src/execution/processing.js';

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
});
