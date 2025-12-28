/**
 * Returns a message requesting initial setup.
 * Provides natural language variations that sound like a professional concierge
 * preparing to serve, avoiding technical jargon.
 *
 * @param forFutureUse - If true, indicates setup is for future requests rather than
 *                       an immediate task
 */
export function getConfigurationRequiredMessage(forFutureUse = false): string {
  if (forFutureUse) {
    const messages = [
      "Before I can assist with your requests, let's get a few things ready.",
      'Let me set up a few things so I can help you in the future.',
      "I'll need to prepare a few things before I can assist you.",
      "Let's get everything ready so I can help with your tasks.",
      "I need to set up a few things first, then I'll be ready to assist.",
      'Let me prepare everything so I can help you going forward.',
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  const messages = [
    'Before I can help, let me get a few things ready.',
    'I need to set up a few things first.',
    'Let me prepare everything before we begin.',
    'Just a moment while I get ready to assist you.',
    "I'll need to get set up before I can help with that.",
    'Let me get everything ready for you.',
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}
