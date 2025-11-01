import { Ollama } from 'ollama';

const MODEL = 'phi3.5:3.8b';

export interface AskResult {
  answer: string;
  error?: string;
}

export async function askQuestion(question: string): Promise<AskResult> {
  try {
    const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

    // Check if Ollama is running
    try {
      await ollama.list();
    } catch (error) {
      return {
        answer: '',
        error: 'Ollama is not running. Please start Ollama first.',
      };
    }

    // Send the question to the model
    const response = await ollama.chat({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Answer questions concisely and clearly. If you need more information to answer properly, ask for it. Keep responses to 1-3 sentences unless more detail is needed.',
        },
        {
          role: 'user',
          content: question,
        },
      ],
      options: {
        temperature: 0.7,
      },
    });

    const answer = response.message.content.trim();

    return {
      answer: answer || 'Sorry, I don\'t know.',
    };
  } catch (error: any) {
    // Handle specific errors
    if (error.message?.includes('model')) {
      return {
        answer: '',
        error: `Model ${MODEL} not found. Please run: ollama pull ${MODEL}`,
      };
    }

    return {
      answer: '',
      error: `Error: ${error.message || 'Unknown error occurred'}`,
    };
  }
}
