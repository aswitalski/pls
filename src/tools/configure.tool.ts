import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const configureTool: Tool = {
  name: 'configure',
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
          'Settings the user wants to configure. Each task specifies which setting to configure.',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description:
                'Description of the setting (from the provided descriptions). Maximum 64 characters.',
            },
            type: {
              type: 'string',
              description: 'Task type. Always "configure" for settings.',
            },
            params: {
              type: 'object',
              description: 'Task parameters.',
              properties: {
                key: {
                  type: 'string',
                  description:
                    'The setting key to configure (e.g., "anthropic.key", "settings.debug").',
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
