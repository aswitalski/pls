import { describe, expect, it, vi } from 'vitest';

import {
  createRefinement,
  createScheduleDefinition,
} from '../../src/services/components.js';
import {
  CommandDefinitionProps,
  CommandState,
  ComponentDefinition,
  ComponentStatus,
  ConfigDefinitionProps,
  ConfigState,
  ConfirmState,
} from '../../src/types/components.js';
import { App, ComponentName, TaskType } from '../../src/types/types.js';
import { ConfigStep, StepType } from '../../src/ui/Config.js';

import { createMockAnthropicService } from '../test-utils.js';
import { DebugLevel } from '../../src/services/configuration.js';

describe('Component Types', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: true,
    debug: DebugLevel.None,
  };

  const mockService = createMockAnthropicService();

  describe('Welcome component definition', () => {
    it('creates valid stateless welcome definition', () => {
      const def: ComponentDefinition = {
        id: 'test-welcome-1',
        name: ComponentName.Welcome,
        status: ComponentStatus.Awaiting,
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
      const state: ConfigState = {
        values: {},
        completedStep: 0,
        selectedIndex: 0,
      };

      const def: ComponentDefinition = {
        id: 'test-config-1',
        name: ComponentName.Config,
        status: ComponentStatus.Awaiting,
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
          onAborted: () => {},
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
        status: ComponentStatus.Awaiting,
        state: {
          values: {},
          completedStep: 0,
          selectedIndex: 0,
        },
        props: {
          steps: stepConfigs,
          onFinished: () => {},
          onAborted: () => {},
        },
      };

      expect(def.props.steps).toHaveLength(3);
      expect(def.props.steps[0]?.key).toBe('username');
      if (def.props.steps[2]?.type === StepType.Text) {
        expect(def.props.steps[2].value).toBe('localhost');
      }
    });

    it('supports onFinished callback', () => {
      const props: ConfigDefinitionProps = {
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
        onAborted: () => {},
      };

      const def: ComponentDefinition = {
        id: 'test-config-3',
        name: ComponentName.Config,
        status: ComponentStatus.Awaiting,
        state: {
          values: {},
          completedStep: 0,
          selectedIndex: 0,
        },
        props,
      };

      expect(def.props.onFinished).toBeDefined();
    });
  });

  describe('Command component definition', () => {
    it('creates valid stateful command definition', () => {
      const state: CommandState = {
        error: null,
        message: null,
        tasks: [],
      };

      const def: ComponentDefinition = {
        id: 'test-command-1',
        name: ComponentName.Command,
        status: ComponentStatus.Awaiting,
        state,
        props: {
          command: 'test command',
          service: mockService,
          onAborted: vi.fn(),
        },
      };

      expect(def.name).toBe(ComponentName.Command);
      expect(def.props.command).toBe('test command');
    });

    it('supports error state', () => {
      const state: CommandState = {
        error: 'Test error',
        message: null,
        tasks: [],
      };

      const def: ComponentDefinition = {
        id: 'test-command-2',
        name: ComponentName.Command,
        status: ComponentStatus.Awaiting,
        state,
        props: {
          command: 'failing command',
          service: mockService,
          onAborted: vi.fn(),
        },
      };

      if ('state' in def) {
        expect(def.state.error).toBe('Test error');
      }
    });

    it('command props do not include error', () => {
      const props: CommandDefinitionProps = {
        command: 'test',
        service: mockService,
        onAborted: vi.fn(),
      };

      const def: ComponentDefinition = {
        id: 'test-command-3',
        name: ComponentName.Command,
        status: ComponentStatus.Awaiting,
        state: {
          error: null,
          message: null,
          tasks: [],
        },
        props,
      };

      expect(def.name).toBe(ComponentName.Command);
    });
  });

  describe('Confirm component definition', () => {
    it('creates valid stateful confirm definition', () => {
      const state: ConfirmState = {
        confirmed: false,
        selectedIndex: 0,
      };

      const def: ComponentDefinition = {
        id: 'test-confirm-1',
        name: ComponentName.Confirm,
        status: ComponentStatus.Awaiting,
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
  });

  describe('Type discrimination', () => {
    it('correctly discriminates between component types', () => {
      const definitions: ComponentDefinition[] = [
        {
          id: 'test-welcome-2',
          name: ComponentName.Welcome,
          status: ComponentStatus.Awaiting,
          props: { app: mockApp },
        },
        {
          id: 'test-config-4',
          name: ComponentName.Config,
          status: ComponentStatus.Awaiting,
          state: {
            values: {},
            completedStep: 0,
            selectedIndex: 0,
          },
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
          status: ComponentStatus.Awaiting,
          state: {
            error: null,
            message: null,
            tasks: [],
          },
          props: {
            command: 'test',
            service: mockService,
            onAborted: vi.fn(),
          },
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
              expect(def.state.values).toBeDefined();
            }
            break;
          case ComponentName.Command:
            expect('state' in def).toBe(true);
            if ('state' in def) {
              expect(def.state.error).toBeDefined();
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
        message: null,
        tasks: [],
      };

      const successState: CommandState = {
        error: null,
        message: 'Success',
        tasks: [],
      };

      const errorDef: ComponentDefinition = {
        id: 'test-command-error',
        name: ComponentName.Command,
        status: ComponentStatus.Awaiting,
        state: errorState,
        props: { command: 'test', service: mockService, onAborted: vi.fn() },
      };

      const successDef: ComponentDefinition = {
        id: 'test-command-success',
        name: ComponentName.Command,
        status: ComponentStatus.Awaiting,
        state: successState,
        props: { command: 'test', service: mockService, onAborted: vi.fn() },
      };

      if ('state' in errorDef) {
        expect(errorDef.state.error).toBe('Processing failed');
      }

      if ('state' in successDef) {
        expect(successDef.state.error).toBeNull();
      }
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

  describe('Schedule component definition', () => {
    it('creates definition without callback for DEFINE tasks', () => {
      const tasks = [
        {
          action: 'Choose option',
          type: TaskType.Define,
          params: { options: ['A', 'B'] },
          config: [],
        },
      ];

      const def = createScheduleDefinition('Select an option.', tasks);

      expect(def.name).toBe(ComponentName.Schedule);
      if (def.name === ComponentName.Schedule) {
        expect(def.props.message).toBe('Select an option.');
        expect(def.props.tasks).toEqual(tasks);
        expect(def.props.onSelectionConfirmed).toBeUndefined();
        expect(def.state).toBeDefined();
        expect(def.state.highlightedIndex).toBeNull();
        expect(def.state.currentDefineGroupIndex).toBe(0);
        expect(def.state.completedSelections).toEqual([]);
      }
    });

    it('creates definition with callback for auto-complete', () => {
      const tasks = [
        { action: 'Build project', type: TaskType.Execute, config: [] },
      ];
      const callback = vi.fn();

      const def = createScheduleDefinition('Building.', tasks, callback);

      expect(def.name).toBe(ComponentName.Schedule);
      if (def.name === ComponentName.Schedule) {
        expect(def.props.message).toBe('Building.');
        expect(def.props.tasks).toEqual(tasks);
        expect(def.props.onSelectionConfirmed).toBe(callback);
        expect(def.state).toBeDefined();
      }
    });

    it('initializes state with correct default values', () => {
      const tasks = [{ action: 'Task 1', type: TaskType.Execute, config: [] }];

      const def = createScheduleDefinition('Processing.', tasks);

      if (def.name === ComponentName.Schedule) {
        expect(def.state.highlightedIndex).toBeNull();
        expect(def.state.currentDefineGroupIndex).toBe(0);
        expect(def.state.completedSelections).toEqual([]);
      }
    });
  });
});
