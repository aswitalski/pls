#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { render, Text } from 'ink';

import {
  hasValidAnthropicKey,
  loadConfig,
  saveAnthropicConfig,
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
  // Happy path: valid config exists
  if (hasValidAnthropicKey()) {
    const config = loadConfig();
    const service = createAnthropicService(config.anthropic);

    render(
      <Main app={app} command={command} service={service} isReady={true} />
    );
    return;
  }

  // Setup: config doesn't exist or is invalid
  const { waitUntilExit, unmount } = render(
    <Main
      app={app}
      command={command}
      isReady={false}
      onConfigured={(config) => {
        saveAnthropicConfig(config);
        if (command) {
          return createAnthropicService(config);
        } else {
          // No command - exit after showing completion message
          setTimeout(() => unmount(), 100);
          return undefined;
        }
      }}
    />
  );
  await waitUntilExit();
}

runApp();
