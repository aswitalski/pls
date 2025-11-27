import { describe, expect, it, vi } from 'vitest';

import { createRefinement } from '../../src/services/components.js';
import {
  BaseState,
  CommandProps,
  CommandState,
  ComponentDefinition,
  ConfigProps,
} from '../../src/types/components.js';
import { App, ComponentName } from '../../src/types/types.js';
import { ConfigStep, StepType } from '../../src/ui/Config.js';

describe('Component Types', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: true,
    isDebug: false,
  };

  describe('Welcome component definition', () => {
    it('creates valid stateless welcome definition', () => {
      const def: ComponentDefinition = {
        id: 'test-welcome-1',
        name: ComponentName.Welcome,
        props: {
          app: mockApp,
        },
      };

      expect(def.name).toBe(ComponentName.Welcome);
      expect(def.props.app).toBe(mockApp);
      expect('state' in def).toBe(false);
    });
  });

  describe('Config component definition', () => {
    it('creates valid stateful config definition', () => {
      const state: BaseState = {
        done: false,
      };

      const def: ComponentDefinition = {
        id: 'test-config-1',
        name: ComponentName.Config,
        state,
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
              value: 'default',
              validate: () => true,
            },
          ],
          onFinished: () => {},
        },
      };

      expect(def.name).toBe(ComponentName.Config);
    });

    it('supports multiple configuration steps', () => {
      const stepConfigs: ConfigStep[] = [
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
      ];

      const def: ComponentDefinition = {
        id: 'test-config-2',
        name: ComponentName.Config,
        state: {},
        props: {
          steps: stepConfigs,
        },
      };

      expect(def.props.steps).toHaveLength(3);
      expect(def.props.steps[0]?.key).toBe('username');
      if (def.props.steps[2]?.type === StepType.Text) {
        expect(def.props.steps[2].value).toBe('localhost');
      }
    });

    it('supports onFinished callback', () => {
      const props: ConfigProps = {
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
        onFinished: (config) => {
          expect(config).toBeDefined();
        },
      };

      const def: ComponentDefinition = {
        id: 'test-config-3',
        name: ComponentName.Config,
        state: {},
        props,
      };

      expect(def.props.onFinished).toBeDefined();
    });
  });

  describe('Command component definition', () => {
    it('creates valid stateful command definition', () => {
      const state: CommandState = {};

      const def: ComponentDefinition = {
        id: 'test-command-1',
        name: ComponentName.Command,
        state,
        props: {
          command: 'test command',
          onAborted: vi.fn(),
        },
      };

      expect(def.name).toBe(ComponentName.Command);
      expect(def.props.command).toBe('test command');
    });

    it('supports error state', () => {
      const state: CommandState = {
        error: 'Test error',
      };

      const def: ComponentDefinition = {
        id: 'test-command-2',
        name: ComponentName.Command,
        state,
        props: {
          command: 'failing command',
          onAborted: vi.fn(),
        },
      };

      expect('state' in def && def.state.error).toBe('Test error');
    });

    it('supports optional error prop', () => {
      const props: CommandProps = {
        command: 'test',
        error: 'Some error',
        onAborted: vi.fn(),
      };

      const def: ComponentDefinition = {
        id: 'test-command-3',
        name: ComponentName.Command,
        state: {},
        props,
      };

      expect(def.props.error).toBe('Some error');
    });
  });

  describe('Confirm component definition', () => {
    it('creates valid stateful confirm definition', () => {
      const state: BaseState = {
        done: false,
      };

      const def: ComponentDefinition = {
        id: 'test-confirm-1',
        name: ComponentName.Confirm,
        state,
        props: {
          message: 'Should I execute this plan?',
          onConfirmed: () => {},
          onCancelled: () => {},
        },
      };

      expect(def.name).toBe(ComponentName.Confirm);
      expect(def.props.message).toBe('Should I execute this plan?');
    });

    it('supports optional callbacks', () => {
      const def: ComponentDefinition = {
        id: 'test-confirm-2',
        name: ComponentName.Confirm,
        state: {},
        props: {
          message: 'Continue?',
        },
      };

      expect(def.props.message).toBe('Continue?');
      expect(def.props.onConfirmed).toBeUndefined();
      expect(def.props.onCancelled).toBeUndefined();
    });
  });

  describe('Type discrimination', () => {
    it('correctly discriminates between component types', () => {
      const definitions: ComponentDefinition[] = [
        {
          id: 'test-welcome-2',
          name: ComponentName.Welcome,
          props: { app: mockApp },
        },
        {
          id: 'test-config-4',
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
          },
        },
        {
          id: 'test-command-4',
          name: ComponentName.Command,
          state: {},
          props: { command: 'test', onAborted: vi.fn() },
        },
      ];

      definitions.forEach((def) => {
        switch (def.name) {
          case ComponentName.Welcome:
            expect('state' in def).toBe(false);
            expect(def.props.app).toBeDefined();
            break;
          case ComponentName.Config:
            expect('state' in def).toBe(true);
            if ('state' in def) {
            }
            break;
          case ComponentName.Command:
            expect('state' in def).toBe(true);
            if ('state' in def) {
            }
            expect(def.props.command).toBeDefined();
            break;
        }
      });
    });
  });

  describe('State lifecycle', () => {
    it('tracks command component error states', () => {
      const errorState: CommandState = {
        error: 'Processing failed',
      };

      const successState: CommandState = {};

      const errorDef: ComponentDefinition = {
        id: 'test-command-error',
        name: ComponentName.Command,
        state: errorState,
        props: { command: 'test', onAborted: vi.fn() },
      };

      const successDef: ComponentDefinition = {
        id: 'test-command-success',
        name: ComponentName.Command,
        state: successState,
        props: { command: 'test', onAborted: vi.fn() },
      };

      expect('state' in errorDef && errorDef.state.error).toBe(
        'Processing failed'
      );

      expect('state' in successDef && successDef.state.error).toBeUndefined();
    });
  });

  describe('Refinement component definition', () => {
    it('creates valid stateful refinement definition', () => {
      const onAborted = vi.fn();
      const def = createRefinement('Processing request', onAborted);

      expect(def.name).toBe(ComponentName.Refinement);
      if (def.name === ComponentName.Refinement) {
        expect(def.props.text).toBe('Processing request');
        expect(def.props.onAborted).toBe(onAborted);
      }
    });
  });
});
