#!/usr/bin/env node

import { generateSkillsCache, getSkillsCachePath } from './dist/services/skills.js';
import { createAnthropicService } from './dist/services/anthropic.js';
import { loadConfig } from './dist/services/configuration.js';
import { readFileSync } from 'fs';

async function main() {
  console.log('Generating skills cache with LLM...\n');

  const config = loadConfig();
  const service = createAnthropicService(config.anthropic);

  await generateSkillsCache(service);

  const cachePath = getSkillsCachePath();
  console.log(`Cache generated at: ${cachePath}\n`);

  const content = readFileSync(cachePath, 'utf-8');
  console.log('=== CACHED SKILLS CONTENT ===');
  console.log(content);
  console.log('\n=== END ===');
}

main().catch(console.error);
