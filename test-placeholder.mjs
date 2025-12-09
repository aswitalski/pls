#!/usr/bin/env node

import { createAnthropicService } from './dist/services/anthropic.js';
import { loadConfig } from './dist/services/configuration.js';
import { replacePlaceholders } from './dist/services/placeholder-resolver.js';
import { loadUserConfig } from './dist/services/config-loader.js';

async function testPlaceholderResolution() {
  const config = loadConfig();
  const service = createAnthropicService(config.anthropic);

  const command = 'navigate to opera one';

  console.log(`Testing placeholder resolution for: "${command}"\n`);

  try {
    // Step 1: PLAN
    console.log('=== CALLING PLAN TOOL ===\n');
    const planResult = await service.processWithTool(command, 'plan');

    console.log('\n=== PLAN COMPLETED ===');
    console.log(`Message: ${planResult.message}`);
    console.log(`Tasks: ${planResult.tasks.length}`);
    console.log(JSON.stringify(planResult.tasks, null, 2));

    // Step 2: EXECUTE (if there are tasks)
    if (planResult.tasks.length > 0) {
      console.log('\n=== CALLING EXECUTE TOOL ===\n');

      // Format tasks for execute tool
      const taskDescriptions = planResult.tasks
        .map((task) => {
          const params = task.params
            ? ` (params: ${JSON.stringify(task.params)})`
            : '';
          return `- ${task.action}${params}`;
        })
        .join('\n');

      const executeResult = await service.processWithTool(
        taskDescriptions,
        'execute'
      );

      console.log('\n=== EXECUTE COMPLETED ===');
      console.log(`Message: ${executeResult.message}`);
      if (executeResult.commands) {
        console.log(`Commands: ${executeResult.commands.length}`);
        console.log(JSON.stringify(executeResult.commands, null, 2));

        // Step 3: Resolve placeholders in commands
        console.log('\n=== RESOLVING PLACEHOLDERS IN COMMANDS ===\n');
        const userConfig = loadUserConfig();

        executeResult.commands.forEach((cmd, index) => {
          console.log(`\nCommand ${index + 1}:`);
          console.log(`Original command: ${cmd.command}`);

          const resolvedCommand = replacePlaceholders(cmd.command, userConfig);

          console.log(`Resolved command: ${resolvedCommand}`);
        });
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testPlaceholderResolution().catch(console.error);
