#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { render, Text } from 'ink';

import {
  loadConfig,
  ConfigError,
  configExists,
  saveConfig,
} from './services/config.js';
import { createAnthropicService } from './services/anthropic.js';

import { Main } from './ui/Main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package info
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// Check if running from development (symlinked) or production
// In dev, package.json is directly in parent dir and src/ exists
// In production, we're in node_modules and src/ doesn't exist alongside
const srcPath = join(__dirname, '../src');
const isDev = existsSync(srcPath);

const app = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  isDev,
};

// Get command from command-line arguments
const args = process.argv.slice(2);
const command = args.join(' ').trim() || null;

async function runApp() {
  // First-time setup: config doesn't exist
  if (!configExists()) {
    const { waitUntilExit } = render(
      <Main
        app={app}
        command={command}
        isReady={false}
        onConfigured={(config) => {
          saveConfig('anthropic', config);
          // Create service once for the session
          return command ? createAnthropicService(config) : undefined;
        }}
      />
    );
    await waitUntilExit();
    return;
  }

  // Try to load and validate config
  try {
    const config = loadConfig();

    // Create service once at app initialization
    const service = createAnthropicService(config.anthropic);

    render(
      <Main app={app} command={command} service={service} isReady={true} />
    );
  } catch (error) {
    if (error instanceof ConfigError) {
      render(<Text color="red">{error.message}</Text>);
      process.exit(1);
    }
    throw error;
  }
}

runApp();
