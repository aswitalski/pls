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
