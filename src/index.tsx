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

import { PLS } from './ui/Please.js';

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

const appInfo = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  isDev,
};

// Get command from command-line arguments
const args = process.argv.slice(2);
const rawCommand = args.join(' ').trim();

async function runApp() {
  // First-time setup: config doesn't exist
  if (!configExists()) {
    const { waitUntilExit } = render(
      <PLS
        app={appInfo}
        command={rawCommand || null}
        showConfigSetup={true}
        onConfigComplete={({ apiKey, model }) => {
          saveConfig(apiKey, model);
          return rawCommand ? createAnthropicService(apiKey, model) : undefined;
        }}
      />
    );
    await waitUntilExit();
    return;
  }

  // Try to load and validate config
  try {
    const config = loadConfig();

    if (!rawCommand) {
      // "pls" when config present: show welcome box
      render(<PLS app={appInfo} command={null} />);
    } else {
      // "pls do stuff": fetch and show the plan
      const claudeService = createAnthropicService(
        config.anthropic.apiKey,
        config.anthropic.model
      );
      render(
        <PLS app={appInfo} command={rawCommand} claudeService={claudeService} />
      );
    }
  } catch (error) {
    if (error instanceof ConfigError) {
      render(<Text color="red">{error.message}</Text>);
      process.exit(1);
    }
    throw error;
  }
}

runApp();
