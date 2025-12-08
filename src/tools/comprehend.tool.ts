import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const comprehendTool: Tool = {
  name: 'comprehend',
  description:
    'Understand user requests by identifying which action verbs match available capabilities (core tools or custom skills). Returns a single list of comprehension items with status indicating match type.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Brief message indicating comprehension is in progress. Single sentence, maximum 48 characters. Empty string ("") for harmful/offensive requests that should be aborted.',
      },
      items: {
        type: 'array',
        description:
          'Array of comprehension items showing all identified commands with their match status',
        items: {
          type: 'object',
          properties: {
            verb: {
              type: 'string',
              description:
                'The action verb extracted from the command (e.g., "deploy", "backup", "build")',
            },
            context: {
              type: 'string',
              description:
                'The rest of the command phrase providing subject/object context (e.g., "alpha", "files", "to staging"). Omit if no additional context.',
            },
            name: {
              type: 'string',
              description:
                'The capability or skill name that matches this verb (omit for unknown status)',
            },
            status: {
              type: 'string',
              enum: ['core', 'custom', 'unknown'],
              description:
                'Match status: "core" for built-in tools (answer, execute, config, introspect), "custom" for user-defined skills, "unknown" for unmatched verbs that will be ignored',
            },
          },
          required: ['verb', 'status'],
        },
      },
      isInformationRequest: {
        type: 'boolean',
        description:
          'True if this is a question/information request (not an action)',
      },
      isIntrospectionRequest: {
        type: 'boolean',
        description: 'True if this is asking about capabilities/skills',
      },
    },
    required: ['message', 'items'],
  },
};
