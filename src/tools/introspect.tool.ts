import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const introspectTool: Tool = {
  name: 'introspect',
  description:
    'Execute a task with type "introspect" to list available capabilities and skills. Called after SCHEDULE has identified an introspection request and user has confirmed. Takes the task action and optional filter parameter to present system capabilities and user-provided skills.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Introductory reply to display before the capabilities list. Must be a single sentence, maximum 64 characters (including the colon at the end). Vary this naturally - try to use a different phrase each time. Always end with a colon.',
      },
      capabilities: {
        type: 'array',
        description:
          'Array of capabilities and skills. Include system capabilities (Introspect, Configure, Answer, Execute) with origin "system", meta workflow capabilities (Schedule, Validate, Report) with origin "meta", and user-provided skills from the Available Skills section with origin "user".',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                'Capability or skill name. Use title case. Maximum 32 characters. Examples: "Execute", "Deploy Application", "Process Data".',
            },
            description: {
              type: 'string',
              description:
                'Brief description of what this capability does. Start with lowercase letter, no ending punctuation. Maximum 64 characters. Examples: "run shell commands and operations", "build and deploy to production".',
            },
            origin: {
              type: 'string',
              enum: ['system', 'user', 'meta'],
              description:
                'Origin of the capability. Use "system" for system capabilities (Introspect, Configure, Answer, Execute), "meta" for meta workflow capabilities (Schedule, Validate, Report), and "user" for user-provided skills.',
            },
            isIncomplete: {
              type: 'boolean',
              description:
                'Optional. Set to true if the skill is marked as incomplete.',
            },
          },
          required: ['name', 'description', 'origin'],
        },
      },
    },
    required: ['message', 'capabilities'],
  },
};
