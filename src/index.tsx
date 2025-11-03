#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render, Text } from 'ink';

import { loadConfig, ConfigError } from './services/config.js';
import { createAnthropicService } from './services/anthropic.js';

import { Please } from './ui/Please.js';

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

// If no command provided, show welcome screen
if (!rawCommand) {
  render(<Please app={appInfo} />);
} else {
  // Load config and create Claude service
  try {
    const config = loadConfig();
    const claudeService = createAnthropicService(config.claudeApiKey!);
    render(
      <Please
        app={appInfo}
        command={rawCommand}
        claudeService={claudeService}
      />
    );
  } catch (error) {
    if (error instanceof ConfigError) {
      render(<Text color="red">{error.message}</Text>);
      process.exit(1);
    }
    throw error;
  }
}
