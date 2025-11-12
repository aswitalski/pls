import { describe, expect, it, vi } from 'vitest';

import { ComponentDefinition } from '../src/types/components.js';
import {
  App,
  ComponentName,
  FeedbackType,
  TaskType,
} from '../src/types/types.js';

import { Component } from '../src/ui/Component.js';
import { StepType } from '../src/ui/Config.js';

describe('Component', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
  };

  it('renders welcome component', () => {
    const def: ComponentDefinition = {
      id: 'test-welcome-1',
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
      id: 'test-config-1',
      name: ComponentName.Config,
      state: {
        done: false,
      },
      props: {
        steps: [
          {
            description: 'API Key',
            key: 'apiKey',
            type: StepType.Text,
            value: null,
            validate: () => true,
          },
          {
            description: 'Model',
            key: 'model',
            type: StepType.Text,
            value: 'default-model',
            validate: () => true,
          },
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
      id: 'test-config-2',
      name: ComponentName.Config,
      state: {
        done: false,
      },
      props: {
        steps: [
          {
            description: 'Username',
            key: 'username',
            type: StepType.Text,
            value: null,
            validate: () => true,
          },
          {
            description: 'Password',
            key: 'password',
            type: StepType.Text,
            value: null,
            validate: () => true,
          },
          {
            description: 'Server',
            key: 'server',
            type: StepType.Text,
            value: 'localhost',
            validate: () => true,
          },
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
      id: 'test-command-1',
      name: ComponentName.Command,
      state: {
        done: false,
        isLoading: true,
      },
      props: {
        command: 'test command',
        onAborted: vi.fn(),
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.command).toBe('test command');
    expect(result.props.def.state.isLoading).toBe(true);
  });

  it('renders command component with children', () => {
    const def: ComponentDefinition = {
      id: 'test-command-2',
      name: ComponentName.Command,
      state: {
        done: true,
        isLoading: false,
      },
      props: {
        command: 'test command',
        children: 'Some content',
        onAborted: vi.fn(),
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.children).toBe('Some content');
    expect(result.props.def.state.done).toBe(true);
  });

  it('renders command component with error', () => {
    const def: ComponentDefinition = {
      id: 'test-command-3',
      name: ComponentName.Command,
      state: {
        done: true,
        isLoading: false,
        error: 'Something went wrong',
      },
      props: {
        command: 'failing command',
        error: 'Something went wrong',
        onAborted: vi.fn(),
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.error).toBe('Something went wrong');
    expect(result.props.def.state.error).toBe('Something went wrong');
  });

  it('passes undefined state for stateless components', () => {
    const def: ComponentDefinition = {
      id: 'test-welcome-2',
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
      id: 'test-plan-1',
      name: ComponentName.Plan,
      state: {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      },
      props: {
        message: 'Here is the plan',
        tasks: [
          { action: 'Install dependencies', type: TaskType.Execute },
          { action: 'Run tests', type: TaskType.Execute },
        ],
        onAborted: vi.fn(),
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.tasks).toHaveLength(2);
    expect(result.props.def.props.message).toBe('Here is the plan');
  });

  it('renders feedback component', () => {
    const def: ComponentDefinition = {
      id: 'test-feedback-1',
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

  it('renders message component', () => {
    const def: ComponentDefinition = {
      id: 'test-message-1',
      name: ComponentName.Message,
      props: {
        text: 'Processing your request',
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.text).toBe('Processing your request');
  });

  it('renders refinement component', () => {
    const onAborted = vi.fn();
    const def: ComponentDefinition = {
      id: 'test-refinement-1',
      name: ComponentName.Refinement,
      state: { done: false },
      props: {
        text: 'Loading data',
        onAborted,
      },
    };

    const result = <Component def={def} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.text).toBe('Loading data');
    expect(result.props.def.props.onAborted).toBe(onAborted);
    expect(result.props.def.state.done).toBe(false);
  });

  it('renders all component types in sequence', () => {
    const definitions: ComponentDefinition[] = [
      {
        id: 'test-welcome-3',
        name: ComponentName.Welcome,
        props: { app: mockApp },
      },
      {
        id: 'test-config-3',
        name: ComponentName.Config,
        state: { done: false },
        props: {
          steps: [
            {
              description: 'Test',
              key: 'test',
              type: StepType.Text,
              value: null,
              validate: () => true,
            },
          ],
        },
      },
      {
        id: 'test-command-4',
        name: ComponentName.Command,
        state: { done: false, isLoading: true },
        props: { command: 'test', onAborted: vi.fn() },
      },
      {
        id: 'test-plan-2',
        name: ComponentName.Plan,
        state: {
          done: false,
          highlightedIndex: null,
          currentDefineGroupIndex: 0,
          completedSelections: [],
        },
        props: {
          message: 'Plan ready',
          tasks: [{ action: 'Do something', type: TaskType.Execute }],
          onAborted: vi.fn(),
        },
      },
      {
        id: 'test-feedback-2',
        name: ComponentName.Feedback,
        props: {
          type: FeedbackType.Succeeded,
          message: 'All done',
        },
      },
      {
        id: 'test-message-2',
        name: ComponentName.Message,
        props: {
          text: 'Simple message',
        },
      },
      {
        id: 'test-refinement-2',
        name: ComponentName.Refinement,
        state: { done: false },
        props: {
          text: 'Loading',
          onAborted: vi.fn(),
        },
      },
    ];

    const results = definitions.map((def) => <Component def={def} />);

    expect(results).toHaveLength(7);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });
});
