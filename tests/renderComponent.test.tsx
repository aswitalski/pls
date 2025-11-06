import { describe, it, expect } from 'vitest';
import { renderComponent } from '../src/ui/renderComponent.js';
import { ComponentDefinition, AppInfo } from '../src/types/components.js';

describe('renderComponent', () => {
  const mockApp: AppInfo = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
  };

  it('renders welcome component', () => {
    const def: ComponentDefinition = {
      name: 'welcome',
      props: {
        app: mockApp,
      },
    };

    const result = renderComponent(def);

    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
    expect(result.props).toBeDefined();
  });

  it('renders configure component without state', () => {
    const def: ComponentDefinition = {
      name: 'configure',
      state: {
        done: false,
        step: 'key',
      },
      props: {
        onComplete: () => {},
      },
    };

    const result = renderComponent(def);

    expect(result).toBeDefined();
    expect(result.props.state).toBeDefined();
    expect(result.props.state.done).toBe(false);
  });

  it('renders configure component with initial values', () => {
    const def: ComponentDefinition = {
      name: 'configure',
      state: {
        done: false,
        step: 'model',
      },
      props: {
        model: 'claude-haiku-4-5-20251001',
      },
    };

    const result = renderComponent(def);

    expect(result).toBeDefined();
    expect(result.props.model).toBe('claude-haiku-4-5-20251001');
    expect(result.props.state.step).toBe('model');
  });

  it('renders command component in loading state', () => {
    const def: ComponentDefinition = {
      name: 'command',
      state: {
        done: false,
        isLoading: true,
      },
      props: {
        command: 'test command',
      },
    };

    const result = renderComponent(def);

    expect(result).toBeDefined();
    expect(result.props.command).toBe('test command');
    expect(result.props.state.isLoading).toBe(true);
  });

  it('renders command component with tasks', () => {
    const def: ComponentDefinition = {
      name: 'command',
      state: {
        done: true,
        isLoading: false,
      },
      props: {
        command: 'test command',
        tasks: ['task 1', 'task 2', 'task 3'],
      },
    };

    const result = renderComponent(def);

    expect(result).toBeDefined();
    expect(result.props.tasks).toEqual(['task 1', 'task 2', 'task 3']);
    expect(result.props.state.done).toBe(true);
  });

  it('renders command component with error', () => {
    const def: ComponentDefinition = {
      name: 'command',
      state: {
        done: true,
        isLoading: false,
        error: 'Something went wrong',
      },
      props: {
        command: 'failing command',
        error: 'Something went wrong',
      },
    };

    const result = renderComponent(def);

    expect(result).toBeDefined();
    expect(result.props.error).toBe('Something went wrong');
    expect(result.props.state.error).toBe('Something went wrong');
  });

  it('passes undefined state for stateless components', () => {
    const def: ComponentDefinition = {
      name: 'welcome',
      props: {
        app: mockApp,
      },
    };

    const result = renderComponent(def);

    // Welcome component doesn't have state, but we verify it doesn't break
    expect(result).toBeDefined();
    expect('state' in result.props).toBe(false);
  });

  it('renders all component types in sequence', () => {
    const definitions: ComponentDefinition[] = [
      {
        name: 'welcome',
        props: { app: mockApp },
      },
      {
        name: 'configure',
        state: { done: false, step: 'key' },
        props: {},
      },
      {
        name: 'command',
        state: { done: false, isLoading: true },
        props: { command: 'test' },
      },
    ];

    const results = definitions.map((def) => renderComponent(def));

    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });
});
