import { describe, it, expect } from 'vitest';
import React from 'react';

import { Column } from '../src/ui/Column.js';
import { Panel } from '../src/ui/Panel.js';
import { List } from '../src/ui/List.js';
import { Config } from '../src/ui/Config.js';
import { Welcome } from '../src/ui/Welcome.js';
import { ComponentDefinition, AppInfo } from '../src/types/components.js';

describe('UI Components', () => {
  const mockApp: AppInfo = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application. For testing purposes.',
    isDev: false,
  };

  describe('Column', () => {
    it('renders empty column', () => {
      const result = <Column items={[]} />;

      expect(result).toBeDefined();
      expect(result.type).toBe(Column);
      expect(result.props.items).toEqual([]);
    });

    it('renders column with single welcome component', () => {
      const items: ComponentDefinition[] = [
        {
          name: 'welcome',
          props: { app: mockApp },
        },
      ];

      const result = <Column items={items} />;

      expect(result).toBeDefined();
      expect(result.props.items).toHaveLength(1);
      expect(result.props.items[0].name).toBe('welcome');
    });

    it('renders column with multiple components in history', () => {
      const items: ComponentDefinition[] = [
        {
          name: 'welcome',
          props: { app: mockApp },
        },
        {
          name: 'config',
          state: { done: true, currentStepIndex: 2 },
          props: {
            steps: [
              { description: 'Username', key: 'username', value: 'testuser' },
              { description: 'Password', key: 'password', value: 'pass123' },
            ],
          },
        },
      ];

      const result = <Column items={items} />;

      expect(result.props.items).toHaveLength(2);
      expect(result.props.items[0].name).toBe('welcome');
      expect(result.props.items[1].name).toBe('config');
    });

    it('renders column with active and historical components', () => {
      const items: ComponentDefinition[] = [
        {
          name: 'welcome',
          props: { app: mockApp },
        },
        {
          name: 'config',
          state: { done: false, currentStepIndex: 0 },
          props: {
            steps: [{ description: 'API Key', key: 'key', value: null }],
          },
        },
      ];

      const result = <Column items={items} />;

      expect(result.props.items).toHaveLength(2);
      expect(result.props.items[1].state.done).toBe(false);
    });
  });

  describe('Panel', () => {
    it('renders panel with text content', () => {
      const result = <Panel>Hello World</Panel>;

      expect(result).toBeDefined();
      expect(result.type).toBe(Panel);
      expect(result.props.children).toBe('Hello World');
    });

    it('renders panel with multiple children', () => {
      const result = (
        <Panel>
          <div>Line 1</div>
          <div>Line 2</div>
        </Panel>
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.props.children)).toBe(true);
    });
  });

  describe('List', () => {
    it('renders empty list', () => {
      const result = <List items={[]} />;

      expect(result).toBeDefined();
      expect(result.props.items).toEqual([]);
    });

    it('renders flat list with single item', () => {
      const items = [
        {
          description: { text: 'Create user account' },
          type: { text: 'plan' },
        },
      ];

      const result = <List items={items} />;

      expect(result.props.items).toHaveLength(1);
      expect(result.props.items[0].description.text).toBe(
        'Create user account'
      );
      expect(result.props.items[0].type.text).toBe('plan');
    });

    it('renders flat list with multiple items', () => {
      const items = [
        {
          description: { text: 'Task 1' },
          type: { text: 'execute' },
        },
        {
          description: { text: 'Task 2' },
          type: { text: 'report' },
        },
      ];

      const result = <List items={items} />;

      expect(result.props.items).toHaveLength(2);
      expect(result.props.items[0].description.text).toBe('Task 1');
      expect(result.props.items[1].description.text).toBe('Task 2');
    });

    it('renders nested list with children', () => {
      const items = [
        {
          description: { text: 'Parent task' },
          type: { text: 'define' },
          children: [
            {
              description: { text: 'Child option 1' },
              type: { text: 'option' },
            },
            {
              description: { text: 'Child option 2' },
              type: { text: 'option' },
            },
          ],
        },
      ];

      const result = <List items={items} />;

      expect(result.props.items).toHaveLength(1);
      expect(result.props.items[0].children).toHaveLength(2);
      expect(result.props.items[0].children?.[0].description.text).toBe(
        'Child option 1'
      );
    });

    it('renders list with custom colors', () => {
      const items = [
        {
          description: { text: 'Important', color: 'red' },
          type: { text: 'warning', color: 'yellow' },
        },
      ];

      const result = <List items={items} />;

      expect(result.props.items[0].description.color).toBe('red');
      expect(result.props.items[0].type.color).toBe('yellow');
    });

    it('renders deeply nested list with level 2', () => {
      const items = [
        {
          description: { text: 'Level 0' },
          type: { text: 'root' },
          children: [
            {
              description: { text: 'Level 1' },
              type: { text: 'child' },
              children: [
                {
                  description: { text: 'Level 2' },
                  type: { text: 'grandchild' },
                },
              ],
            },
          ],
        },
      ];

      const result = <List items={items} />;

      expect(result.props.items[0].children?.[0].children).toHaveLength(1);
      expect(
        result.props.items[0].children?.[0].children?.[0].description.text
      ).toBe('Level 2');
    });

    it('supports custom level prop for indentation', () => {
      const items = [
        {
          description: { text: 'Task' },
          type: { text: 'plan' },
        },
      ];

      const result = <List items={items} level={2} />;

      expect(result.props.level).toBe(2);
    });
  });

  describe('Config', () => {
    it('renders first step when not started', () => {
      const steps = [
        { description: 'Username', key: 'username', value: null },
        { description: 'Email', key: 'email', value: null },
      ];

      const result = (
        <Config steps={steps} state={{ done: false, currentStepIndex: 0 }} />
      );

      expect(result.props.steps).toHaveLength(2);
      expect(result.props.state.currentStepIndex).toBe(0);
      expect(result.props.state.done).toBe(false);
    });

    it('renders completed steps with values', () => {
      const steps = [
        { description: 'Username', key: 'username', value: null },
        { description: 'Email', key: 'email', value: null },
      ];

      const result = (
        <Config steps={steps} state={{ done: false, currentStepIndex: 1 }} />
      );

      expect(result.props.state.currentStepIndex).toBe(1);
    });

    it('shows all steps when done', () => {
      const steps = [
        { description: 'Username', key: 'username', value: null },
        { description: 'Email', key: 'email', value: null },
      ];

      const result = (
        <Config steps={steps} state={{ done: true, currentStepIndex: 2 }} />
      );

      expect(result.props.state.done).toBe(true);
      expect(result.props.state.currentStepIndex).toBe(2);
    });

    it('displays default values when provided', () => {
      const steps = [
        { description: 'Server', key: 'server', value: 'localhost' },
      ];

      const result = (
        <Config steps={steps} state={{ done: false, currentStepIndex: 0 }} />
      );

      expect(result.props.steps[0].value).toBe('localhost');
    });

    it('transitions from interactive to completed state', () => {
      const steps = [{ description: 'API Key', key: 'apiKey', value: null }];

      // Interactive state
      const interactive = (
        <Config steps={steps} state={{ done: false, currentStepIndex: 0 }} />
      );

      expect(interactive.props.state.done).toBe(false);

      // Completed state
      const completed = (
        <Config steps={steps} state={{ done: true, currentStepIndex: 1 }} />
      );

      expect(completed.props.state.done).toBe(true);
    });

    it('supports onFinished callback', () => {
      const steps = [{ description: 'Test', key: 'test', value: null }];
      const onFinished = (config: Record<string, string>) => {
        expect(config).toBeDefined();
      };

      const result = (
        <Config
          steps={steps}
          state={{ done: false, currentStepIndex: 0 }}
          onFinished={onFinished}
        />
      );

      expect(result.props.onFinished).toBe(onFinished);
    });
  });

  describe('Welcome', () => {
    it('renders with app info', () => {
      const result = <Welcome app={mockApp} />;

      expect(result).toBeDefined();
      expect(result.props.app).toBe(mockApp);
    });

    it('renders with different app info', () => {
      const customApp: AppInfo = {
        name: 'my-custom-app',
        version: '2.0.0',
        description: 'Custom application. Very cool.',
        isDev: true,
      };

      const result = <Welcome app={customApp} />;

      expect(result.props.app.name).toBe('my-custom-app');
      expect(result.props.app.version).toBe('2.0.0');
      expect(result.props.app.isDev).toBe(true);
    });

    it('handles dev and non-dev modes', () => {
      const devApp = { ...mockApp, isDev: true };
      const prodApp = { ...mockApp, isDev: false };

      const devResult = <Welcome app={devApp} />;
      const prodResult = <Welcome app={prodApp} />;

      expect(devResult.props.app.isDev).toBe(true);
      expect(prodResult.props.app.isDev).toBe(false);
    });

    it('renders with multi-sentence description', () => {
      const multiSentenceApp: AppInfo = {
        name: 'test',
        version: '1.0.0',
        description: 'First sentence. Second sentence. Third sentence.',
        isDev: false,
      };

      const result = <Welcome app={multiSentenceApp} />;

      expect(result.props.app.description).toContain('First sentence');
      expect(result.props.app.description).toContain('Second sentence');
      expect(result.props.app.description).toContain('Third sentence');
    });
  });
});
