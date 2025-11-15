import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const planTool: Tool = {
  name: 'plan',
  description:
    'Plan and structure tasks from a user command. Break down the request into clear, actionable steps with type information and parameters. When refining previously selected tasks, the input will be formatted as lowercase actions with types in brackets, e.g., "install the python development environment (type: execute), explain how virtual environments work (type: answer)".',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description:
          'Introductory reply to display before the task list. Must be a single sentence, maximum 64 characters (including the colon at the end). Vary this naturally - try to use a different phrase each time.',
      },
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
                'Type of task: "config" (settings), "plan" (planning), "execute" (shell/programs/finding files), "answer" (questions, NOT for capability queries), "introspect" (list capabilities/skills), "report" (summaries), "define" (skill-based disambiguation), "ignore" (too vague)',
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
    required: ['message', 'tasks'],
  },
};
