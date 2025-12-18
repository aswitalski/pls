import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

export const answerTool: Tool = {
  name: 'answer',
  description:
    'Answer questions and provide up-to-date information using web search. Called after SCHEDULE has identified an answer request and user has confirmed. Searches the web for current data and provides concise, helpful responses formatted for terminal display.',
  input_schema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description:
          'The question or information request from the user. Should be a clear, complete question.',
      },
      answer: {
        type: 'string',
        description:
          'The answer to the question. Must be concise and well-formatted. Maximum 4 lines of text, each line maximum 80 characters. Use natural line breaks for readability.',
      },
    },
    required: ['question', 'answer'],
  },
};
