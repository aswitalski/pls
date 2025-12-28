import { getUnresolvedPlaceholdersMessage } from '../services/messages.js';

/**
 * Validates that all placeholders in a command have been resolved.
 * Throws an error if unresolved placeholders are found.
 */
export function validatePlaceholderResolution(command: string): void {
  const unresolvedPattern = /\{[^}]+\}/g;
  const matches = command.match(unresolvedPattern);

  if (matches && matches.length > 0) {
    throw new Error(getUnresolvedPlaceholdersMessage(matches.length));
  }
}
