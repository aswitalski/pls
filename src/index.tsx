#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';

import { Please } from './ui/Please.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package info
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// Check if running from development (symlinked) or production
const isDev = process.argv[1]?.includes('/node_modules/.bin/') === false;

const appInfo = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  isDev,
};

render(<Please app={appInfo} />);
