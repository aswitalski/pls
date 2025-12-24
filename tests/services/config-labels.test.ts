import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getConfigLabel,
  loadConfigLabels,
  saveConfigLabels,
} from '../../src/services/config-labels.js';
import { safeRemoveDirectory } from '../test-utils.js';

describe('Config labels', () => {
  const testCacheDir = join(homedir(), '.pls', 'cache');
  const testCachePath = join(testCacheDir, 'config.json');

  beforeEach(() => {
    if (existsSync(testCachePath)) {
      rmSync(testCachePath);
    }
  });

  afterEach(() => {
    if (existsSync(testCachePath)) {
      rmSync(testCachePath);
    }
  });

  it('returns empty object when cache does not exist', () => {
    expect(loadConfigLabels()).toEqual({});
  });

  it('saves and loads labels', () => {
    const labels = { 'project.alpha.repo': 'Path to Alpha project' };
    saveConfigLabels(labels);

    expect(loadConfigLabels()).toEqual(labels);
  });

  it('merges with existing labels', () => {
    saveConfigLabels({ 'project.alpha.repo': 'Path to Alpha' });
    saveConfigLabels({ 'project.beta.repo': 'Path to Beta' });

    const labels = loadConfigLabels();
    expect(labels['project.alpha.repo']).toBe('Path to Alpha');
    expect(labels['project.beta.repo']).toBe('Path to Beta');
  });

  it('returns undefined for missing key', () => {
    expect(getConfigLabel('missing.key')).toBeUndefined();
  });

  it('returns label for existing key', () => {
    saveConfigLabels({ 'test.key': 'Test Label' });

    expect(getConfigLabel('test.key')).toBe('Test Label');
  });

  it('handles corrupted cache gracefully', () => {
    if (!existsSync(testCacheDir)) {
      mkdirSync(testCacheDir, { recursive: true });
    }
    writeFileSync(testCachePath, 'invalid json');

    expect(loadConfigLabels()).toEqual({});
  });

  it('creates cache directory when saving', () => {
    if (existsSync(testCacheDir)) {
      safeRemoveDirectory(testCacheDir);
    }

    saveConfigLabels({ 'test.key': 'Test' });

    expect(existsSync(testCacheDir)).toBe(true);
    expect(existsSync(testCachePath)).toBe(true);
  });
});
