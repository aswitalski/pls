#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import React from 'react';
import { render } from 'ink';
import { Please } from '../src/ui/Please.js';
import { Usage } from '../src/ui/Usage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package version
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

// Check if running from development (symlinked) or production
const isDev = process.argv[1]?.includes('/node_modules/.bin/') === false;
const versionInfo = isDev ? `pls ${packageJson.version} (dev)` : `pls ${packageJson.version}`;

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  render(React.createElement(Usage, { versionInfo }));
  process.exit(0);
}

const command = args[0];

if (command === 'tell' && args[1] === 'me') {
  const question = args.slice(2).join(' ');

  if (!question) {
    render(React.createElement(Usage, { versionInfo, error: 'Please provide a question' }));
    process.exit(1);
  }

  // Render the Ink UI
  render(React.createElement(Please, { question, versionInfo }));
} else {
  render(React.createElement(Usage, { versionInfo, error: `Unknown command: ${command}` }));
  process.exit(1);
}
