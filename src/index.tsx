#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import React from 'react';
import { render } from 'ink';

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

render(<Please app={appInfo} />);
