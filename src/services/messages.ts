import { DebugLevel } from '../configuration/types.js';

import { loadDebugSetting } from '../configuration/io.js';

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
 * Returns an error message when the request cannot be understood.
 * Randomly selects from variations to sound natural.
 */
export function getUnknownRequestMessage(): string {
  const messages = [
    'I do not understand the request.',
    'I cannot understand what you want me to do.',
    "I'm not sure what you're asking for.",
    'I cannot determine what action to take.',
    'This request is unclear to me.',
    'I do not recognize this command.',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Returns an error message for unknown skill references.
 * Randomly selects from variations to sound natural.
 * Skill name should be a verb with details (e.g., "Deploy Application")
 */
export function getUnknownSkillMessage(skillName: string): string {
  const templates = [
    `I don't know how to "${skillName}".`,
    `I'm not familiar with the "${skillName}" command.`,
    `I haven't learned how to "${skillName}" yet.`,
    `I can't "${skillName}".`,
    `I'm unable to "${skillName}".`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Returns an error message for mixed task types.
 */
export function getMixedTaskTypesError(types: string[]): string {
  const typeList = types.join(', ');
  return `Mixed task types are not supported. Found: ${typeList}. All tasks in a plan must have the same type.`;
}

/**
 * Returns a message for unresolved placeholders/missing configuration.
 * Each message has two sentences: what's missing + what will be done.
 * Both sentences are randomly selected independently for variety.
 * Supports singular and plural forms.
 */
export function getUnresolvedPlaceholdersMessage(count: number): string {
  const plural = count === 1 ? '' : 's';
  const it = count === 1 ? 'it' : 'them';
  const valueWord = count === 1 ? 'value' : 'values';

  // First sentence: what's missing
  const firstSentences = [
    `Missing configuration ${valueWord} detected.`,
    `Configuration ${valueWord} needed.`,
    `Found unresolved placeholder${plural}.`,
    `Additional configuration ${valueWord} required.`,
    `Setup requires configuration ${valueWord}.`,
  ];

  // Second sentence: what will be done
  const secondSentences = [
    `Let me gather ${it} now.`,
    `I'll set ${it} up for you.`,
    `Let me configure ${it} first.`,
    `I'll help you provide ${it}.`,
    `Let me collect ${it} from you.`,
  ];

  const first =
    firstSentences[Math.floor(Math.random() * firstSentences.length)];
  const second =
    secondSentences[Math.floor(Math.random() * secondSentences.length)];

  return `${first} ${second}`;
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

  if (loadDebugSetting() !== DebugLevel.None) {
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

/**
 * Returns an execution error message with varied phrasing.
 * Error details are shown in the task output, so this is just a summary.
 * Randomly selects from variations to sound natural.
 */
export function getExecutionErrorMessage(_error: string): string {
  const messages = [
    'The execution failed.',
    'Execution has failed.',
    'The execution was not successful.',
    'Execution did not succeed.',
    'The execution encountered an error.',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
