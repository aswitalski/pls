import { describe, expect, it, vi } from 'vitest';

import { ComponentDefinition } from '../../src/types/components.js';
import {
  App,
  ComponentName,
  FeedbackType,
  TaskType,
} from '../../src/types/types.js';

import { DebugLevel } from '../../src/services/configuration.js';

import { Component } from '../../src/ui/Component.js';
import { StepType } from '../../src/ui/Config.js';

import { createMockAnthropicService } from '../test-utils.js';

describe('Component', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
    debug: DebugLevel.None,
  };

  const mockService = createMockAnthropicService();

  it('renders welcome component', () => {
    const def: ComponentDefinition = {
      id: 'test-welcome-1',
      name: ComponentName.Welcome,
      props: {
        app: mockApp,
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
    expect(result.props).toBeDefined();
  });

  it('renders config component without state', () => {
    const def: ComponentDefinition = {
      id: 'test-config-1',
      name: ComponentName.Config,
      state: {},
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
        onAborted: () => {},
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.props.def.state).toBeDefined();
  });

  it('renders config component with multiple steps', () => {
    const def: ComponentDefinition = {
      id: 'test-config-2',
      name: ComponentName.Config,
      state: {},
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
        onFinished: () => {},
        onAborted: () => {},
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.steps).toHaveLength(3);
  });

  it('renders command component', () => {
    const def: ComponentDefinition = {
      id: 'test-command-1',
      name: ComponentName.Command,
      state: {},
      props: {
        command: 'test command',
        service: mockService,
        onAborted: vi.fn(),
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.command).toBe('test command');
  });

  it('renders command component with error', () => {
    const def: ComponentDefinition = {
      id: 'test-command-3',
      name: ComponentName.Command,
      state: {
        error: 'Something went wrong',
      },
      props: {
        command: 'failing command',
        service: mockService,
        error: 'Something went wrong',
        onAborted: vi.fn(),
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

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

    const result = <Component def={def} debug={DebugLevel.None} />;

    // Welcome component doesn't have state, but we verify it doesn't break
    expect(result).toBeDefined();
    expect('state' in result.props.def).toBe(false);
  });

  it('renders schedule component', () => {
    const def: ComponentDefinition = {
      id: 'test-schedule-1',
      name: ComponentName.Schedule,
      state: {
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      },
      props: {
        message: 'Here is the schedule',
        tasks: [
          { action: 'Install dependencies', type: TaskType.Execute },
          { action: 'Run tests', type: TaskType.Execute },
        ],
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.tasks).toHaveLength(2);
    expect(result.props.def.props.message).toBe('Here is the schedule');
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

    const result = <Component def={def} debug={DebugLevel.None} />;

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

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.text).toBe('Processing your request');
  });

  it('renders refinement component', () => {
    const onAborted = vi.fn();
    const def: ComponentDefinition = {
      id: 'test-refinement-1',
      name: ComponentName.Refinement,
      state: {},
      props: {
        text: 'Loading data',
        onAborted,
      },
    };

    const result = <Component def={def} debug={DebugLevel.None} />;

    expect(result).toBeDefined();
    expect(result.props.def.props.text).toBe('Loading data');
    expect(result.props.def.props.onAborted).toBe(onAborted);
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
        state: {},
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
          onFinished: () => {},
          onAborted: () => {},
        },
      },
      {
        id: 'test-command-4',
        name: ComponentName.Command,
        state: {},
        props: { command: 'test', service: mockService, onAborted: vi.fn() },
      },
      {
        id: 'test-schedule-2',
        name: ComponentName.Schedule,
        state: {
          highlightedIndex: null,
          currentDefineGroupIndex: 0,
          completedSelections: [],
        },
        props: {
          message: 'Schedule ready',
          tasks: [{ action: 'Do something', type: TaskType.Execute }],
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
        state: {},
        props: {
          text: 'Loading',
          onAborted: vi.fn(),
        },
      },
    ];

    const results = definitions.map((def) => (
      <Component def={def} debug={DebugLevel.None} />
    ));

    expect(results).toHaveLength(7);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });
});
