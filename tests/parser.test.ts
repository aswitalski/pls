import { describe, it, expect } from 'vitest';
import { parseCommands } from '../src/parser.js';

describe('parseCommands', () => {
  it('parses single task', () => {
    const result = parseCommands('install dependencies');
    expect(result).toEqual(['install dependencies']);
  });

  it('parses comma-separated tasks', () => {
    const result = parseCommands(
      'install dependencies, run tests, build project'
    );
    expect(result).toEqual([
      'install dependencies',
      'run tests',
      'build project',
    ]);
  });

  it('strips exclamation marks', () => {
    const result = parseCommands('install dependencies!, run tests!');
    expect(result).toEqual(['install dependencies', 'run tests']);
  });

  it('strips periods', () => {
    const result = parseCommands('install dependencies., run tests.');
    expect(result).toEqual(['install dependencies', 'run tests']);
  });

  it('strips both exclamation marks and periods', () => {
    const result = parseCommands('install dependencies!., run tests.!');
    expect(result).toEqual(['install dependencies', 'run tests']);
  });

  it('handles extra whitespace', () => {
    const result = parseCommands(
      '  install dependencies  ,  run tests  ,  build project  '
    );
    expect(result).toEqual([
      'install dependencies',
      'run tests',
      'build project',
    ]);
  });

  it('filters out empty tasks', () => {
    const result = parseCommands('install dependencies, , run tests');
    expect(result).toEqual(['install dependencies', 'run tests']);
  });

  it('handles mixed punctuation and whitespace', () => {
    const result = parseCommands(
      'install dependencies!  , run tests. , build project!.'
    );
    expect(result).toEqual([
      'install dependencies',
      'run tests',
      'build project',
    ]);
  });

  it('returns empty array for empty string', () => {
    const result = parseCommands('');
    expect(result).toEqual([]);
  });

  it('returns empty array for only punctuation and commas', () => {
    const result = parseCommands('!, ., !.');
    expect(result).toEqual([]);
  });
});
