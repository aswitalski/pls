import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Key } from 'ink';

import {
  registerGlobalShortcut,
  isGlobalShortcut,
  clearGlobalShortcuts,
} from '../../src/services/keyboard.js';

describe('Keyboard service', () => {
  beforeEach(() => {
    clearGlobalShortcuts();
  });

  describe('registerGlobalShortcut', () => {
    it('registers a shortcut with handler', () => {
      const handler = vi.fn();
      registerGlobalShortcut('shift+tab', handler);

      const key = {
        shift: true,
        tab: true,
      } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('registers multiple shortcuts independently', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registerGlobalShortcut('shift+tab', handler1);
      registerGlobalShortcut('ctrl+escape', handler2);

      const key1 = { shift: true, tab: true } as Key;
      const key2 = { ctrl: true, escape: true } as Key;

      isGlobalShortcut(key1);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();

      isGlobalShortcut(key2);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('handles case-insensitive patterns', () => {
      const handler = vi.fn();
      registerGlobalShortcut('SHIFT+TAB', handler);

      const key = { shift: true, tab: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('isGlobalShortcut', () => {
    it('returns false when no shortcuts registered', () => {
      const key = { shift: true, tab: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(false);
    });

    it('returns false when key does not match registered shortcuts', () => {
      const handler = vi.fn();
      registerGlobalShortcut('shift+tab', handler);

      const key = { tab: true } as Key; // No shift

      const result = isGlobalShortcut(key);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns true and calls handler when key matches', () => {
      const handler = vi.fn();
      registerGlobalShortcut('shift+tab', handler);

      const key = { shift: true, tab: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches escape key', () => {
      const handler = vi.fn();
      registerGlobalShortcut('escape', handler);

      const key = { escape: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches ctrl modifier', () => {
      const handler = vi.fn();
      registerGlobalShortcut('ctrl+escape', handler);

      const key = { ctrl: true, escape: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches meta modifier', () => {
      const handler = vi.fn();
      registerGlobalShortcut('meta+tab', handler);

      const key = { meta: true, tab: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches multiple modifiers', () => {
      const handler = vi.fn();
      registerGlobalShortcut('ctrl+shift+escape', handler);

      const key = { ctrl: true, shift: true, escape: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches arrow keys', () => {
      const handler = vi.fn();
      registerGlobalShortcut('shift+up', handler);

      const key = { shift: true, upArrow: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches return key', () => {
      const handler = vi.fn();
      registerGlobalShortcut('ctrl+return', handler);

      const key = { ctrl: true, return: true } as Key;

      const result = isGlobalShortcut(key);

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('matches backspace and delete keys', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registerGlobalShortcut('ctrl+backspace', handler1);
      registerGlobalShortcut('ctrl+delete', handler2);

      const key1 = { ctrl: true, backspace: true } as Key;
      const key2 = { ctrl: true, delete: true } as Key;

      isGlobalShortcut(key1);
      isGlobalShortcut(key2);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('returns false for unrecognized key combinations', () => {
      const key = {} as Key; // No recognized keys

      const result = isGlobalShortcut(key);

      expect(result).toBe(false);
    });
  });

  describe('clearGlobalShortcuts', () => {
    it('clears all registered shortcuts', () => {
      const handler = vi.fn();
      registerGlobalShortcut('shift+tab', handler);

      clearGlobalShortcuts();

      const key = { shift: true, tab: true } as Key;
      const result = isGlobalShortcut(key);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('allows re-registration after clearing', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registerGlobalShortcut('shift+tab', handler1);
      clearGlobalShortcuts();
      registerGlobalShortcut('shift+tab', handler2);

      const key = { shift: true, tab: true } as Key;
      isGlobalShortcut(key);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pattern matching edge cases', () => {
    it('does not match when only modifier is present', () => {
      const handler = vi.fn();
      registerGlobalShortcut('shift+tab', handler);

      const key = { shift: true } as Key; // Shift without tab

      const result = isGlobalShortcut(key);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('does not match when extra modifiers are present', () => {
      const handler = vi.fn();
      registerGlobalShortcut('tab', handler);

      const key = { shift: true, tab: true } as Key; // Has shift, but registered without

      const result = isGlobalShortcut(key);

      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('matches exact modifier combination', () => {
      const handler = vi.fn();
      registerGlobalShortcut('ctrl+shift+tab', handler);

      // Missing ctrl - should not match
      const key1 = { shift: true, tab: true } as Key;
      expect(isGlobalShortcut(key1)).toBe(false);

      // Exact match
      const key2 = { ctrl: true, shift: true, tab: true } as Key;
      expect(isGlobalShortcut(key2)).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handler execution', () => {
    it('executes handler immediately when shortcut matches', () => {
      let executed = false;
      const handler = () => {
        executed = true;
      };

      registerGlobalShortcut('shift+tab', handler);

      const key = { shift: true, tab: true } as Key;
      isGlobalShortcut(key);

      expect(executed).toBe(true);
    });

    it('allows handler to modify external state', () => {
      let count = 0;
      const handler = () => {
        count++;
      };

      registerGlobalShortcut('shift+tab', handler);

      const key = { shift: true, tab: true } as Key;

      isGlobalShortcut(key);
      isGlobalShortcut(key);
      isGlobalShortcut(key);

      expect(count).toBe(3);
    });
  });
});
