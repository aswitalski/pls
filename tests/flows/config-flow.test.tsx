import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../src/configuration/types.js';
import { App } from '../../src/types/types.js';

import { loadConfig } from '../../src/configuration/io.js';
import { getMissingConfigKeys } from '../../src/configuration/schema.js';
import { exitApp } from '../../src/services/process.js';

import { Main } from '../../src/ui/Main.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
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

const ShortWait = 50;

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
    vi.mocked(getMissingConfigKeys).mockReturnValue([]);
    vi.mocked(loadConfig).mockReturnValue({
      anthropic: { key: 'test-key', model: 'test-model' },
    });
    vi.mocked(exitApp).mockImplementation(() => {});
  });

  it('shows welcome screen and exits when no config and no command', async () => {
    const { lastFrame } = render(<Main app={mockApp} command={null} />);

    await new Promise((resolve) => setTimeout(resolve, ShortWait));

    const output = lastFrame();
    expect(output).toContain('Test');
    expect(exitApp).toHaveBeenCalledWith(0);
  });

  it('shows welcome and config flow for first-time users', async () => {
    const { lastFrame } = render(<Main app={mockApp} command={null} />);

    await new Promise((resolve) => setTimeout(resolve, ShortWait));

    const output = lastFrame();
    expect(output).toContain('Test');
  });
});
