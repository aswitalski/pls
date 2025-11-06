import { describe, it, expect } from 'vitest';
import {
  ComponentDefinition,
  ConfigureProps,
  CommandProps,
  ConfigureState,
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

  describe('ConfigureDefinition', () => {
    it('creates valid stateful configure definition', () => {
      const state: ConfigureState = {
        done: false,
        step: 'key',
      };

      const def: ComponentDefinition = {
        name: 'configure',
        state,
        props: {
          onComplete: () => {},
        },
      };

      expect(def.name).toBe('configure');
      expect('state' in def && def.state.done).toBe(false);
      expect('state' in def && def.state.step).toBe('key');
    });

    it('supports all configure steps', () => {
      const steps: Array<'key' | 'model' | 'done'> = ['key', 'model', 'done'];

      steps.forEach((step) => {
        const state: ConfigureState = {
          done: step === 'done',
          step,
        };

        const def: ComponentDefinition = {
          name: 'configure',
          state,
          props: {},
        };

        expect('state' in def && def.state.step).toBe(step);
      });
    });

    it('supports optional key and model props', () => {
      const props: ConfigureProps = {
        key: 'sk-ant-test',
        model: 'claude-haiku-4-5-20251001',
      };

      const def: ComponentDefinition = {
        name: 'configure',
        state: { done: false },
        props,
      };

      expect(def.props.key).toBe('sk-ant-test');
      expect(def.props.model).toBe('claude-haiku-4-5-20251001');
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

    it('supports optional tasks and error props', () => {
      const props: CommandProps = {
        command: 'test',
        tasks: ['task 1', 'task 2'],
        error: 'Some error',
        systemPrompt: 'Test prompt',
      };

      const def: ComponentDefinition = {
        name: 'command',
        state: { done: false },
        props,
      };

      expect(def.props.tasks).toEqual(['task 1', 'task 2']);
      expect(def.props.error).toBe('Some error');
      expect(def.props.systemPrompt).toBe('Test prompt');
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
          name: 'configure',
          state: { done: false },
          props: {},
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
          case 'configure':
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
    it('tracks configure component from start to done', () => {
      const states: ConfigureState[] = [
        { done: false, step: 'key' },
        { done: false, step: 'model' },
        { done: true, step: 'done' },
      ];

      states.forEach((state, index) => {
        const def: ComponentDefinition = {
          name: 'configure',
          state,
          props: {},
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
