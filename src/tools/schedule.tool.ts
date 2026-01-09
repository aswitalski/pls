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
          step: {
            type: 'number',
            description:
              'Step number (1-based integer). REQUIRED for ALL type="execute" tasks. Indicates which execution line from the skill this task corresponds to (1=first line, 2=second line, etc). For single-step skills: always 1. For multi-step skills: use the corresponding line number (1, 2, 3, etc).',
          },
          params: {
            type: 'object',
            description:
              'Parameters for leaf tasks. For "define" type: { skill: string, options: Array<{ name: string, command: string }> }. "name" is display text, "command" is full resolved command.',
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
        required: ['action', 'type'],
        if: {
          properties: {
            type: { const: 'execute' },
          },
        },
        then: {
          required: ['step'],
        },
      },
    },
  },
};
