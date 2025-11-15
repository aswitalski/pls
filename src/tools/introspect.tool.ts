import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const introspectTool: Tool = {
  name: 'introspect',
  description:
    'Execute a task with type "introspect" to list available capabilities and skills. Called after PLAN has identified an introspection request and user has confirmed. Takes the task action and optional filter parameter to present built-in capabilities and user-defined skills.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Introductory reply to display before the capabilities list. Must be a single sentence, maximum 64 characters (including the colon at the end). Vary this naturally - try to use a different phrase each time. Always end with a colon.',
      },
      tasks: {
        type: 'array',
        description:
          'Array of capabilities, each with type "introspect". Include built-in capabilities (PLAN, INTROSPECT, ANSWER, EXECUTE, REPORT, CONFIG) and user-defined skills from the Available Skills section.',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description:
                'Capability name and description. Format: "NAME: Brief description". Maximum 64 characters. Examples: "PLAN: Break down requests into steps", "Deploy App: Build and deploy application".',
            },
            type: {
              type: 'string',
              description: 'Always "introspect" for capability listings.',
            },
          },
          required: ['action', 'type'],
        },
      },
    },
    required: ['message', 'tasks'],
  },
};
