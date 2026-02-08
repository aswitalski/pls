import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const discoverTool: Tool = {
  name: 'discover',
  description:
    'Discover the appropriate shell command for a natural language request. ' +
    'Translates user intent into a specific shell command based on the ' +
    'operating system and shell type. Called after SCHEDULE has identified ' +
    'a discover request and user has confirmed.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Brief status message about the discovery. Must be a single ' +
          'sentence, maximum 64 characters, ending with a period.',
      },
      command: {
        type: 'object',
        description: 'The discovered command to execute',
        properties: {
          description: {
            type: 'string',
            description:
              'Brief description of what this command does. Maximum 64 ' +
              'characters.',
          },
          command: {
            type: 'string',
            description:
              'The exact shell command to run. Must be a valid, runnable ' +
              'shell command appropriate for the detected OS and shell.',
          },
          workdir: {
            type: 'string',
            description:
              'Optional working directory for the command. Defaults to ' +
              'current directory if not specified.',
          },
          timeout: {
            type: 'number',
            description:
              'Optional timeout in milliseconds. Defaults to 30000 ' +
              '(30 seconds).',
          },
        },
        required: ['description', 'command'],
      },
    },
    required: ['message', 'command'],
  },
};
