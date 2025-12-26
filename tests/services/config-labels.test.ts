import { homedir } from 'os';
import { join } from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getConfigLabel,
  loadConfigLabels,
  saveConfigLabels,
} from '../../src/services/config-labels.js';
import { MemoryFileSystem } from '../../src/services/filesystem.js';

describe('Config labels', () => {
  const testCacheDir = join(homedir(), '.pls', 'cache');
  const testCachePath = join(testCacheDir, 'config.json');
  let fs: MemoryFileSystem;

  beforeEach(() => {
    fs = new MemoryFileSystem();
  });

  it('returns empty object when cache does not exist', () => {
    expect(loadConfigLabels(fs)).toEqual({});
  });

  it('saves and loads labels', () => {
    const labels = { 'project.alpha.repo': 'Path to Alpha project' };
    saveConfigLabels(labels, fs);

    expect(loadConfigLabels(fs)).toEqual(labels);
  });

  it('merges with existing labels', () => {
    saveConfigLabels({ 'project.alpha.repo': 'Path to Alpha' }, fs);
    saveConfigLabels({ 'project.beta.repo': 'Path to Beta' }, fs);

    const labels = loadConfigLabels(fs);
    expect(labels['project.alpha.repo']).toBe('Path to Alpha');
    expect(labels['project.beta.repo']).toBe('Path to Beta');
  });

  it('returns undefined for missing key', () => {
    expect(getConfigLabel('missing.key', fs)).toBeUndefined();
  });

  it('returns label for existing key', () => {
    saveConfigLabels({ 'test.key': 'Test Label' }, fs);

    expect(getConfigLabel('test.key', fs)).toBe('Test Label');
  });

  it('handles corrupted cache gracefully', () => {
    fs.createDirectory(testCacheDir, { recursive: true });
    fs.writeFile(testCachePath, 'invalid json');

    expect(loadConfigLabels(fs)).toEqual({});
  });

  it('creates cache directory when saving', () => {
    saveConfigLabels({ 'test.key': 'Test' }, fs);

    expect(fs.exists(testCacheDir)).toBe(true);
    expect(fs.exists(testCachePath)).toBe(true);
  });
});
