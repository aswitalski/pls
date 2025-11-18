import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import React from 'react';

import {
  registerGlobalShortcut,
  clearGlobalShortcuts,
  useInput,
} from '../../src/services/keyboard.js';

describe('useInput custom hook', () => {
  beforeEach(() => {
    clearGlobalShortcuts();
  });

  it('calls component handler for non-global shortcuts', () => {
    const componentHandler = vi.fn();

    function TestComponent() {
      useInput(componentHandler);
      return <Text>test</Text>;
    }

    const { stdin } = render(<TestComponent />);

    // Send a tab key (not registered as global)
    stdin.write('\t');

    expect(componentHandler).toHaveBeenCalled();
  });

  it('respects isActive option', () => {
    const componentHandler = vi.fn();

    function TestComponent() {
      useInput(componentHandler, { isActive: false });
      return <Text>test</Text>;
    }

    const { stdin } = render(<TestComponent />);

    stdin.write('\t');

    expect(componentHandler).not.toHaveBeenCalled();
  });

  it('passes through input and key to component handler', () => {
    let receivedInput: string | undefined;
    let receivedKey: any;

    function TestComponent() {
      useInput((input, key) => {
        receivedInput = input;
        receivedKey = key;
      });
      return <Text>test</Text>;
    }

    const { stdin } = render(<TestComponent />);

    stdin.write('a');

    expect(receivedInput).toBe('a');
    expect(receivedKey).toBeDefined();
  });

  it('handles escape key in component', () => {
    const componentHandler = vi.fn();

    function TestComponent() {
      useInput((input, key) => {
        if (key.escape) {
          componentHandler();
        }
      });
      return <Text>test</Text>;
    }

    const { stdin } = render(<TestComponent />);

    // Send escape key
    stdin.write('\x1B');

    expect(componentHandler).toHaveBeenCalled();
  });

  it('allows component to handle Tab when Shift+Tab is global', () => {
    const globalHandler = vi.fn();
    const tabHandler = vi.fn();

    registerGlobalShortcut('shift+tab', globalHandler);

    function TestComponent() {
      useInput((input, key) => {
        if (key.tab && !key.shift) {
          tabHandler();
        }
      });
      return <Text>test</Text>;
    }

    const { stdin } = render(<TestComponent />);

    // Send regular Tab
    stdin.write('\t');

    expect(tabHandler).toHaveBeenCalled();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it('works with multiple components', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    function Component1() {
      useInput(handler1, { isActive: true });
      return <Text>component1</Text>;
    }

    function Component2() {
      useInput(handler2, { isActive: false });
      return <Text>component2</Text>;
    }

    function TestApp() {
      return (
        <>
          <Component1 />
          <Component2 />
        </>
      );
    }

    const { stdin } = render(<TestApp />);

    stdin.write('a');

    // Only active component should receive input
    expect(handler1).toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('updates when isActive changes', () => {
    const componentHandler = vi.fn();

    function TestComponent({ active }: { active: boolean }) {
      useInput(componentHandler, { isActive: active });
      return <Text>test</Text>;
    }

    const { stdin, rerender } = render(<TestComponent active={false} />);

    stdin.write('a');
    expect(componentHandler).not.toHaveBeenCalled();

    // Activate the handler
    rerender(<TestComponent active={true} />);

    stdin.write('b');
    expect(componentHandler).toHaveBeenCalledTimes(1);
  });
});
