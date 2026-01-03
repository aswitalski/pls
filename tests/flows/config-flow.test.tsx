import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../src/configuration/types.js';
import { App } from '../../src/types/types.js';

import { loadConfig } from '../../src/configuration/io.js';
import { getMissingConfigKeys } from '../../src/configuration/schema.js';
import { exitApp } from '../../src/services/process.js';

import { Main } from '../../src/Main.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ELAPSED_UPDATE_INTERVAL: 250,
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

// Mock configuration modules
vi.mock('../../src/configuration/schema.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/configuration/schema.js')
  >('../../src/configuration/schema.js');
  return {
    ...actual,
    getMissingConfigKeys: vi.fn(),
  };
});

vi.mock('../../src/configuration/io.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/configuration/io.js')
  >('../../src/configuration/io.js');
  return {
    ...actual,
    loadConfig: vi.fn(),
  };
});

// Mock process module
vi.mock('../../src/services/process.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/services/process.js')
  >('../../src/services/process.js');
  return {
    ...actual,
    exitApp: vi.fn(),
  };
});

describe('Configuration flow', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
    debug: DebugLevel.None,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exitApp).mockImplementation(() => {});
  });

  it('shows welcome and exits when config is complete and no command', async () => {
    vi.mocked(getMissingConfigKeys).mockReturnValue([]);
    vi.mocked(loadConfig).mockReturnValue({
      anthropic: { key: 'test-key', model: 'test-model' },
    });

    const { lastFrame } = render(<Main app={mockApp} command={null} />);

    await vi.waitFor(
      () => {
        expect(lastFrame()).toContain('Test');
        expect(exitApp).toHaveBeenCalledWith(0);
      },
      { timeout: 500 }
    );
  });

  it('shows config wizard when keys are missing', async () => {
    vi.mocked(getMissingConfigKeys).mockReturnValue([
      'anthropic.key',
      'anthropic.model',
    ]);

    const { lastFrame } = render(<Main app={mockApp} command={null} />);

    await vi.waitFor(
      () => {
        const output = lastFrame();
        expect(output).toContain('Test'); // Welcome shown
        expect(output).toContain('Anthropic API key'); // Config wizard prompting
      },
      { timeout: 500 }
    );

    // Should NOT exit - waiting for config input
    expect(exitApp).not.toHaveBeenCalled();
  });
});
