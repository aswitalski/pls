import { describe, it, expect } from 'vitest';
import {
  ComponentDefinition,
  ConfigProps,
  CommandProps,
  BaseState,
  CommandState,
  AppInfo,
} from '../src/types/components.js';

describe('Component Types', () => {
  const mockApp: AppInfo = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: true,
  };

  describe('WelcomeDefinition', () => {
    it('creates valid stateless welcome definition', () => {
      const def: ComponentDefinition = {
        name: 'welcome',
        props: {
          app: mockApp,
        },
      };

      expect(def.name).toBe('welcome');
      expect(def.props.app).toBe(mockApp);
      expect('state' in def).toBe(false);
    });
  });

  describe('ConfigDefinition', () => {
    it('creates valid stateful config definition', () => {
      const state: BaseState = {
        done: false,
      };

      const def: ComponentDefinition = {
        name: 'config',
        state,
        props: {
          steps: [
            { description: 'API Key', key: 'apiKey', value: null },
            { description: 'Model', key: 'model', value: 'default' },
          ],
          onFinished: () => {},
        },
      };

      expect(def.name).toBe('config');
      expect('state' in def && def.state.done).toBe(false);
    });

    it('supports multiple configuration steps', () => {
      const stepConfigs = [
        { description: 'Username', key: 'username', value: null },
        { description: 'Password', key: 'password', value: null },
        { description: 'Server', key: 'server', value: 'localhost' },
      ];

      const def: ComponentDefinition = {
        name: 'config',
        state: { done: false },
        props: {
          steps: stepConfigs,
        },
      };

      expect(def.props.steps).toHaveLength(3);
      expect(def.props.steps[0].key).toBe('username');
      expect(def.props.steps[2].value).toBe('localhost');
    });

    it('supports onFinished callback', () => {
      const props: ConfigProps = {
        steps: [
          { description: 'API Key', key: 'apiKey', value: null },
          { description: 'Model', key: 'model', value: 'default-model' },
        ],
        onFinished: (config) => {
          expect(config).toBeDefined();
        },
      };

      const def: ComponentDefinition = {
        name: 'config',
        state: { done: false },
        props,
      };

      expect(def.props.onFinished).toBeDefined();
    });
  });

  describe('CommandDefinition', () => {
    it('creates valid stateful command definition', () => {
      const state: CommandState = {
        done: false,
        isLoading: true,
      };

      const def: ComponentDefinition = {
        name: 'command',
        state,
        props: {
          command: 'test command',
        },
      };

      expect(def.name).toBe('command');
      expect('state' in def && def.state.done).toBe(false);
      expect('state' in def && def.state.isLoading).toBe(true);
      expect(def.props.command).toBe('test command');
    });

    it('supports error state', () => {
      const state: CommandState = {
        done: true,
        isLoading: false,
        error: 'Test error',
      };

      const def: ComponentDefinition = {
        name: 'command',
        state,
        props: {
          command: 'failing command',
        },
      };

      expect('state' in def && def.state.error).toBe('Test error');
    });

    it('supports optional error and children props', () => {
      const props: CommandProps = {
        command: 'test',
        error: 'Some error',
        children: 'Test content',
      };

      const def: ComponentDefinition = {
        name: 'command',
        state: { done: false },
        props,
      };

      expect(def.props.error).toBe('Some error');
      expect(def.props.children).toBe('Test content');
    });
  });

  describe('Type discrimination', () => {
    it('correctly discriminates between component types', () => {
      const definitions: ComponentDefinition[] = [
        {
          name: 'welcome',
          props: { app: mockApp },
        },
        {
          name: 'config',
          state: { done: false },
          props: {
            steps: [{ description: 'Test', key: 'test', value: null }],
          },
        },
        {
          name: 'command',
          state: { done: false },
          props: { command: 'test' },
        },
      ];

      definitions.forEach((def) => {
        switch (def.name) {
          case 'welcome':
            expect('state' in def).toBe(false);
            expect(def.props.app).toBeDefined();
            break;
          case 'config':
            expect('state' in def).toBe(true);
            if ('state' in def) {
              expect(def.state.done).toBeDefined();
            }
            break;
          case 'command':
            expect('state' in def).toBe(true);
            if ('state' in def) {
              expect(def.state.done).toBeDefined();
            }
            expect(def.props.command).toBeDefined();
            break;
        }
      });
    });
  });

  describe('State lifecycle', () => {
    it('tracks config component from start to done', () => {
      const states: BaseState[] = [
        { done: false },
        { done: false },
        { done: true },
      ];

      states.forEach((state, index) => {
        const def: ComponentDefinition = {
          name: 'config',
          state,
          props: {
            steps: [
              { description: 'Step 1', key: 'step1', value: null },
              { description: 'Step 2', key: 'step2', value: null },
            ],
          },
        };

        if (index < 2) {
          expect('state' in def && def.state.done).toBe(false);
        } else {
          expect('state' in def && def.state.done).toBe(true);
        }
      });
    });

    it('tracks command component loading states', () => {
      const loadingState: CommandState = {
        done: false,
        isLoading: true,
      };

      const completedState: CommandState = {
        done: true,
        isLoading: false,
      };

      const loadingDef: ComponentDefinition = {
        name: 'command',
        state: loadingState,
        props: { command: 'test' },
      };

      const completedDef: ComponentDefinition = {
        name: 'command',
        state: completedState,
        props: { command: 'test' },
      };

      expect('state' in loadingDef && loadingDef.state.isLoading).toBe(true);
      expect('state' in loadingDef && loadingDef.state.done).toBe(false);

      expect('state' in completedDef && completedDef.state.isLoading).toBe(
        false
      );
      expect('state' in completedDef && completedDef.state.done).toBe(true);
    });
  });
});
