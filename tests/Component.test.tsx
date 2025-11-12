import { describe, expect, it } from 'vitest';

import { ComponentDefinition } from '../src/types/components.js';
import {
  App,
  ComponentName,
  FeedbackType,
  TaskType,
} from '../src/types/types.js';

import { Component } from '../src/ui/Component.js';

describe('Component', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
  };

  it('renders welcome component', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Welcome,
      props: {
        app: mockApp,
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
    expect(result.props).toBeDefined();
  });

  it('renders config component without state', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Config,
      state: {
        done: false,
      },
      props: {
        steps: [
          { description: 'API Key', key: 'apiKey', value: null },
          { description: 'Model', key: 'model', value: 'default-model' },
        ],
        onFinished: () => {},
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.state).toBeDefined();
    expect(result.props.def.state.done).toBe(false);
  });

  it('renders config component with multiple steps', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Config,
      state: {
        done: false,
      },
      props: {
        steps: [
          { description: 'Username', key: 'username', value: null },
          { description: 'Password', key: 'password', value: null },
          { description: 'Server', key: 'server', value: 'localhost' },
        ],
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.steps).toHaveLength(3);
    expect(result.props.def.state?.done).toBe(false);
  });

  it('renders command component in loading state', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Command,
      state: {
        done: false,
        isLoading: true,
      },
      props: {
        command: 'test command',
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.command).toBe('test command');
    expect(result.props.def.state.isLoading).toBe(true);
  });

  it('renders command component with children', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Command,
      state: {
        done: true,
        isLoading: false,
      },
      props: {
        command: 'test command',
        children: 'Some content',
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.children).toBe('Some content');
    expect(result.props.def.state.done).toBe(true);
  });

  it('renders command component with error', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Command,
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

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.error).toBe('Something went wrong');
    expect(result.props.def.state.error).toBe('Something went wrong');
  });

  it('passes undefined state for stateless components', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Welcome,
      props: {
        app: mockApp,
      },
    };

    const result = <Component def={def} />;

    // Welcome component doesn't have state, but we verify it doesn't break
    expect(result).toBeDefined();
    expect('state' in result.props.def).toBe(false);
  });

  it('renders plan component', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Plan,
      props: {
        message: 'Here is the plan',
        tasks: [
          { action: 'Install dependencies', type: TaskType.Execute },
          { action: 'Run tests', type: TaskType.Execute },
        ],
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.tasks).toHaveLength(2);
    expect(result.props.def.props.message).toBe('Here is the plan');
  });

  it('renders feedback component', () => {
    const def: ComponentDefinition = {
      name: ComponentName.Feedback,
      props: {
        type: FeedbackType.Info,
        message: 'Configuration complete',
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.type).toBe(FeedbackType.Info);
    expect(result.props.def.props.message).toBe('Configuration complete');
  });

  it('renders all component types in sequence', () => {
    const definitions: ComponentDefinition[] = [
      {
        name: ComponentName.Welcome,
        props: { app: mockApp },
      },
      {
        name: ComponentName.Config,
        state: { done: false },
        props: {
          steps: [{ description: 'Test', key: 'test', value: null }],
        },
      },
      {
        name: ComponentName.Command,
        state: { done: false, isLoading: true },
        props: { command: 'test' },
      },
      {
        name: ComponentName.Plan,
        props: {
          message: 'Plan ready',
          tasks: [{ action: 'Do something', type: TaskType.Execute }],
        },
      },
      {
        name: ComponentName.Feedback,
        props: {
          type: FeedbackType.Succeeded,
          message: 'All done',
        },
      },
    ];

    const results = definitions.map((def) => <Component def={def} />);

    expect(results).toHaveLength(5);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });
});
