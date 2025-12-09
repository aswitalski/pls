#!/usr/bin/env node

import { createAnthropicService } from './dist/services/anthropic.js';
import { loadConfig } from './dist/services/configuration.js';
import { validateExecuteTasks } from './dist/services/execution-validator.js';

async function testConfigValidation() {
  const config = loadConfig();
  const service = createAnthropicService(config.anthropic);

  const command = 'navigate to gx';

  console.log(`Testing config validation for: "${command}"\n`);

  try {
    // Step 1: PLAN
    console.log('=== STEP 1: PLAN ===\n');
    const planResult = await service.processWithTool(command, 'plan');

    console.log('Plan result:');
    console.log(`  Message: ${planResult.message}`);
    console.log(`  Tasks: ${JSON.stringify(planResult.tasks, null, 2)}\n`);

    // Step 2: VALIDATE (this should trigger config validation logging)
    console.log('=== STEP 2: CONFIG VALIDATION ===\n');
    const validation = validateExecuteTasks(planResult.tasks);

    console.log('\nValidation result:');
    console.log(`  Missing config: ${validation.missingConfig.length} path(s)`);
    if (validation.missingConfig.length > 0) {
      validation.missingConfig.forEach((req) => {
        console.log(`    - ${req.path} (${req.type})`);
      });
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testConfigValidation().catch(console.error);
