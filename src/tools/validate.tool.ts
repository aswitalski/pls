import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const validateTool: Tool = {
  name: 'validate',
  description:
    'Validate skill requirements and generate natural language descriptions for missing configuration values. Given skill context and missing config paths, create CONFIG tasks with helpful, contextual descriptions.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Empty string or brief message (not shown to user, can be left empty)',
      },
      tasks: {
        type: 'array',
        description:
          'Array of CONFIG tasks with natural language descriptions for missing config values',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description:
                'Natural language description explaining what the config value is for, followed by the config path in curly brackets {config.path}. Example: "Path to Alpha project repository (legacy implementation) {project.alpha.repo}"',
            },
            type: {
              type: 'string',
              description:
                'Must be "config" for all tasks returned by this tool',
            },
            params: {
              type: 'object',
              description: 'Must include key field with the config path',
              properties: {
                key: {
                  type: 'string',
                  description: 'The config path (e.g., "opera.gx.repo")',
                },
              },
              required: ['key'],
            },
          },
          required: ['action', 'type', 'params'],
        },
      },
    },
    required: ['message', 'tasks'],
  },
};
