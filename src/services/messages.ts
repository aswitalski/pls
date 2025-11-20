import { loadDebugSetting } from './configuration.js';

export { formatDuration } from './utils.js';

/**
 * Returns a natural language confirmation message for plan execution.
 * Randomly selects from variations to sound less robotic.
 */
export function getConfirmationMessage(): string {
  const messages = [
    'Should I execute this plan?',
    'Do you want me to proceed with these tasks?',
    'Ready to execute?',
    'Shall I execute this plan?',
    'Would you like me to run these tasks?',
    'Execute this plan?',
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Returns a refining message shown during plan refinement.
 * Randomly selects from variations to sound natural.
 */
export function getRefiningMessage(): string {
  const messages = [
    'Let me work out the specifics for you.',
    "I'll figure out the concrete steps.",
    'Let me break this down into tasks.',
    "I'll plan out the details.",
    'Let me arrange the steps.',
    "I'll prepare everything you need.",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Returns a cancellation message for the given operation.
 * Randomly selects from variations to sound natural.
 */
export function getCancellationMessage(operation: string): string {
  const templates = [
    `I've cancelled the ${operation.toLowerCase()}.`,
    `I've aborted the ${operation.toLowerCase()}.`,
    `The ${operation.toLowerCase()} was cancelled.`,
    `The ${operation.toLowerCase()} has been aborted.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Feedback messages for various operations
 */
export const FeedbackMessages = {
  ConfigurationComplete: 'Configuration complete.',
  UnexpectedError: 'Unexpected error occurred:',
} as const;

/**
 * Extracts a user-friendly error message from API errors.
 * In debug mode, returns the full error; otherwise, returns just the message.
 *
 * Handles Anthropic API error format:
 * 400 {"type":"error","error":{"type":"...","message":"..."},"request_id":"..."}
 */
export function formatErrorMessage(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : 'Unknown error occurred';

  if (loadDebugSetting()) {
    return rawMessage;
  }

  // Try to extract message from Anthropic API error format
  // Format: "400 {json...}" or just "{json...}"
  const jsonMatch = rawMessage.match(/\{.*\}/s);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        error?: { message?: string };
        message?: string;
      };
      const message = parsed.error?.message ?? parsed.message;
      if (message) {
        return message;
      }
    } catch {
      // JSON parsing failed, return original message
    }
  }

  return rawMessage;
}
