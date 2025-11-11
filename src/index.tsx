#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { render } from 'ink';

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

// Render application
render(<Main app={app} command={command} />);
