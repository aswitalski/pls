import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const planTool: Tool = {
  name: 'plan',
  description:
    'Plan and structure tasks from a user command. Break down the request into clear, actionable steps with type information and parameters.',
  input_schema: {
    type: 'object',
    properties: {
      tasks: {
        type: 'array',
        description: 'Array of planned tasks to execute',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description:
                'Clear description of what needs to be done in this task',
            },
            type: {
              type: 'string',
              description:
                'Type of task: "config" (settings), "plan" (planning), "execute" (shell/programs/finding files), "answer" (questions), "report" (summaries), "define" (skill-based disambiguation), "ignore" (too vague)',
            },
            params: {
              type: 'object',
              description:
                'Task-specific parameters (e.g., command, path, url, etc.)',
            },
          },
          required: ['action'],
        },
      },
    },
    required: ['tasks'],
  },
};
