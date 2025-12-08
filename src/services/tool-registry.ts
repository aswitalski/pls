import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ToolConfig {
  schema: Tool;
  instructionsPath: string;
}

class ToolRegistry {
  private tools: Map<string, ToolConfig> = new Map();

  register(name: string, config: ToolConfig): void {
    this.tools.set(name, config);
  }

  getTool(name: string): ToolConfig | undefined {
    return this.tools.get(name);
  }

  getInstructions(name: string): string {
    const config = this.getTool(name);
    if (!config) {
      throw new Error(`Tool '${name}' not found in registry`);
    }

    const instructionsPath = resolve(__dirname, '..', config.instructionsPath);
    return readFileSync(instructionsPath, 'utf-8');
  }

  getSchema(name: string): Tool {
    const config = this.getTool(name);
    if (!config) {
      throw new Error(`Tool '${name}' not found in registry`);
    }
    return config.schema;
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

// Create singleton instance
export const toolRegistry = new ToolRegistry();

// Register built-in tools
import { answerTool } from '../tools/answer.tool.js';
import { configTool } from '../tools/config.tool.js';
import { executeTool } from '../tools/execute.tool.js';
import { introspectTool } from '../tools/introspect.tool.js';
import { planTool } from '../tools/plan.tool.js';
import { validateTool } from '../tools/validate.tool.js';

const tools: Record<string, Tool> = {
  answer: answerTool,
  config: configTool,
  execute: executeTool,
  introspect: introspectTool,
  plan: planTool,
  validate: validateTool,
};

for (const [name, schema] of Object.entries(tools)) {
  toolRegistry.register(name, {
    schema,
    instructionsPath: `skills/${name}.md`,
  });
}
