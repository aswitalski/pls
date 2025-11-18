import { useInput as useInkInput } from 'ink';
import type { Key } from 'ink';

type KeyboardHandler = () => void;

const globalShortcuts = new Map<string, KeyboardHandler>();

/**
 * Converts a Key object to a normalized pattern string
 * Example: { shift: true, tab: true } → "shift+tab"
 */
function keyToPattern(key: Key): string | null {
  const modifiers: string[] = [];

  if (key.ctrl) modifiers.push('ctrl');
  if (key.meta) modifiers.push('meta');
  if (key.shift) modifiers.push('shift');

  // Get the key name
  let keyName = '';
  if (key.escape) keyName = 'escape';
  else if (key.tab) keyName = 'tab';
  else if (key.return) keyName = 'return';
  else if (key.upArrow) keyName = 'up';
  else if (key.downArrow) keyName = 'down';
  else if (key.leftArrow) keyName = 'left';
  else if (key.rightArrow) keyName = 'right';
  else if (key.backspace) keyName = 'backspace';
  else if (key.delete) keyName = 'delete';

  if (!keyName) return null;

  return [...modifiers, keyName].join('+');
}

/**
 * Register a global keyboard shortcut
 * @param pattern Pattern string like "shift+tab" or "ctrl+c"
 * @param handler Function to call when shortcut is triggered
 */
export function registerGlobalShortcut(
  pattern: string,
  handler: KeyboardHandler
): void {
  globalShortcuts.set(pattern.toLowerCase(), handler);
}

/**
 * Check if a key event matches a global shortcut
 * If matched, calls the handler and returns true
 * If not matched, returns false
 * @param key The key object from ink's useInput
 * @returns true if global shortcut was handled, false otherwise
 */
export function isGlobalShortcut(key: Key): boolean {
  const pattern = keyToPattern(key);
  if (!pattern) return false;

  const handler = globalShortcuts.get(pattern.toLowerCase());
  if (handler) {
    handler();
    return true;
  }

  return false;
}

/**
 * Clear all registered global shortcuts (useful for testing)
 */
export function clearGlobalShortcuts(): void {
  globalShortcuts.clear();
}

/**
 * Custom useInput hook that automatically handles global shortcuts
 * before passing events to the component handler
 * @param handler Component's keyboard event handler
 * @param options Options for useInput (isActive, etc.)
 */
export function useInput(
  handler: (input: string, key: Key) => void,
  options?: { isActive?: boolean }
): void {
  useInkInput((input, key) => {
    // Check for global shortcuts first
    if (isGlobalShortcut(key)) {
      return; // Global shortcut handled, don't propagate to component
    }

    // No global shortcut matched, call component handler
    handler(input, key);
  }, options);
}
