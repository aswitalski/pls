#!/usr/bin/env node

import { replacePlaceholders } from './dist/services/placeholder-resolver.js';
import { loadUserConfig } from './dist/services/config-loader.js';

console.log('Testing placeholder resolution with MISSING config:\n');

const userConfig = loadUserConfig();

// Test 1: Existing config
console.log('=== TEST 1: Existing Config ===');
const command1 = 'cd {opera.one.repo}';
console.log(`Command: ${command1}`);
const resolved1 = replacePlaceholders(command1, userConfig);
console.log(`Result: ${resolved1}\n`);

// Test 2: Missing config (gx.repo doesn't exist in config)
console.log('\n=== TEST 2: Missing Config ===');
const command2 = 'cd {opera.gx.repo}';
console.log(`Command: ${command2}`);
const resolved2 = replacePlaceholders(command2, userConfig);
console.log(`Result: ${resolved2}\n`);

// Test 3: Partially missing path
console.log('\n=== TEST 3: Non-existent Section ===');
const command3 = 'connect {database.production.url}';
console.log(`Command: ${command3}`);
const resolved3 = replacePlaceholders(command3, userConfig);
console.log(`Result: ${resolved3}\n`);
