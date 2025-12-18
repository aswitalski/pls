import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const scheduleTool: Tool = {
  name: 'schedule',
  description:
    'Organize user requests into hierarchical task structures with dynamically nested subtasks. Create logical groupings based on workflow phases and shared purposes. Supports multiple levels of nesting.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Introductory message before the schedule. Single sentence, max 64 characters. Vary naturally.',
      },
      tasks: {
        type: 'array',
        description: 'Array of top-level tasks with optional nested subtasks',
        items: {
          $ref: '#/$defs/task',
        },
      },
    },
    required: ['message', 'tasks'],
    $defs: {
      task: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Description of what needs to be done (max 64 chars)',
          },
          type: {
            type: 'string',
            description:
              'Type: "group" for parent tasks with subtasks. For leaf tasks: "configure", "execute", "answer", "introspect", "report", "define", "ignore"',
          },
          params: {
            type: 'object',
            description: 'Parameters for leaf tasks (e.g., command, path)',
          },
          config: {
            type: 'array',
            description:
              'Array of configuration paths needed for this task in dot notation (e.g., ["product.alpha.path", "env.staging.url"])',
            items: {
              type: 'string',
            },
          },
          subtasks: {
            type: 'array',
            description:
              'Optional nested subtasks. Omit for executable leaf tasks.',
            items: {
              $ref: '#/$defs/task',
            },
          },
        },
        required: ['action'],
      },
    },
  },
};
