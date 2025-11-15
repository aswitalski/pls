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
