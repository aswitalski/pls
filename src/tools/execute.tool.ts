import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const executeTool: Tool = {
  name: 'execute',
  description:
    'Execute shell commands from scheduled tasks. Translates task descriptions into specific shell commands that can be run in the terminal. Called after SCHEDULE has created execute tasks and user has confirmed.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Brief status message about the execution. Must be a single sentence, maximum 64 characters, ending with a period.',
      },
      summary: {
        type: 'string',
        description:
          'Natural language summary as if execution has finished, like a concierge would report. Shown after execution completes with time appended. Use varied expressions and synonyms, not necessarily the same verb as the message. Must be a single sentence without period, maximum 48 characters. MUST NOT be empty. Example: "Project ready to go" (time will be appended as " in X seconds").',
      },
      commands: {
        type: 'array',
        description: 'Array of commands to execute sequentially',
        items: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description:
                'Brief description of what this command does. Maximum 64 characters.',
            },
            command: {
              type: 'string',
              description:
                'The exact shell command to run. Must be a valid shell command.',
            },
            workdir: {
              type: 'string',
              description:
                'Optional working directory for the command. Defaults to current directory if not specified.',
            },
            timeout: {
              type: 'number',
              description:
                'Optional timeout in milliseconds. Defaults to 30000 (30 seconds).',
            },
            critical: {
              type: 'boolean',
              description:
                'Whether failure should stop execution of subsequent commands. Defaults to true.',
            },
          },
          required: ['description', 'command'],
        },
      },
      error: {
        type: 'string',
        description:
          'Error message when execution cannot proceed. Only include this field when returning an empty commands array due to validation failure (e.g., skill not found, missing Steps/Execution sections). Describes what went wrong.',
      },
    },
    required: ['message', 'summary', 'commands'],
  },
};
