import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const configTool: Tool = {
  name: 'config',
  description:
    'Determine which configuration settings to show based on user query. Receives available config keys with descriptions and returns which keys the user wants to configure.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Brief message to display before config plan. Single sentence, maximum 64 characters. End with period.',
      },
      tasks: {
        type: 'array',
        description:
          'Array of config settings to configure. Each task has type "config" and params with the config key.',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description:
                'Description of the config setting (from the provided descriptions). Maximum 64 characters.',
            },
            type: {
              type: 'string',
              description: 'Always "config" for configuration tasks.',
            },
            params: {
              type: 'object',
              description: 'Parameters for the config task.',
              properties: {
                key: {
                  type: 'string',
                  description:
                    'The config key to configure (e.g., "anthropic.key", "settings.debug").',
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
