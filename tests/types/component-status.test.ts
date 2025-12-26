import { describe, expect, it, vi } from 'vitest';

import {
  ComponentStatus,
  BaseRuntimeProps,
  ComponentDefinition,
} from '../../src/types/components.js';
import { ComponentName } from '../../src/types/types.js';
import { DebugLevel } from '../../src/services/configuration.js';

describe('ComponentDefinition with status', () => {
  it('allows stateless component with status', () => {
    const definition: ComponentDefinition = {
      id: 'test-1',
      name: ComponentName.Welcome,
      props: {
        app: {
          name: 'test',
          version: '1.0.0',
          description: 'Test app',
          isDev: false,
          debug: DebugLevel.None,
        },
      },
      status: ComponentStatus.Done,
    };

    expect(definition.status).toBe(ComponentStatus.Done);
  });

  it('allows stateful component with status', () => {
    const definition: ComponentDefinition = {
      id: 'test-2',
      name: ComponentName.Confirm,
      state: {},
      props: {
        message: 'Test?',
        onConfirmed: vi.fn(),
        onCancelled: vi.fn(),
      },
      status: ComponentStatus.Active,
    };

    expect(definition.status).toBe(ComponentStatus.Active);
  });

  it('allows component without status', () => {
    const definition: ComponentDefinition = {
      id: 'test-3',
      name: ComponentName.Message,
      props: {
        text: 'Hello',
      },
    };

    expect(definition.status).toBeUndefined();
  });

  it('allows all status values on components', () => {
    const statuses = [
      ComponentStatus.Awaiting,
      ComponentStatus.Active,
      ComponentStatus.Pending,
      ComponentStatus.Done,
    ];

    statuses.forEach((status) => {
      const definition: ComponentDefinition = {
        id: `test-${status}`,
        name: ComponentName.Message,
        props: { text: 'Test' },
        status,
      };
      expect(definition.status).toBe(status);
    });
  });
});

describe('BaseRuntimeProps with status', () => {
  it('includes optional status field', () => {
    const props: BaseRuntimeProps = {
      status: ComponentStatus.Active,
    };

    expect(props.status).toBe(ComponentStatus.Active);
  });

  it('allows status without isActive', () => {
    const props: BaseRuntimeProps = {
      status: ComponentStatus.Pending,
    };

    expect(props.status).toBe(ComponentStatus.Pending);
  });
});

describe('Component lifecycle transitions', () => {
  it('represents full lifecycle with status enum', () => {
    // Component starts as Awaiting
    let status: ComponentStatus = ComponentStatus.Awaiting;
    expect(status).toBe(ComponentStatus.Awaiting);

    // Moves to Active when dequeued
    status = ComponentStatus.Active;
    expect(status).toBe(ComponentStatus.Active);

    // Can move to Pending while awaiting user decision
    status = ComponentStatus.Pending;
    expect(status).toBe(ComponentStatus.Pending);

    // Finally moves to Done
    status = ComponentStatus.Done;
    expect(status).toBe(ComponentStatus.Done);
  });

  it('allows direct transition from Active to Done', () => {
    let status: ComponentStatus = ComponentStatus.Active;
    expect(status).toBe(ComponentStatus.Active);

    // Can skip Pending and go directly to Done
    status = ComponentStatus.Done;
    expect(status).toBe(ComponentStatus.Done);
  });
});

describe('Type safety', () => {
  it('enforces status is ComponentStatus enum', () => {
    const definition: ComponentDefinition = {
      id: 'test',
      name: ComponentName.Message,
      props: { text: 'Test' },
      // @ts-expect-error - Invalid status value
      status: 'invalid',
    };

    // TypeScript should catch this at compile time
    expect(definition).toBeDefined();
  });

  it('state field requires BaseState extension', () => {
    const definition: ComponentDefinition = {
      id: 'test',
      name: ComponentName.Confirm,
      state: { confirmed: true },
      props: {
        message: 'Test?',
        onConfirmed: vi.fn(),
        onCancelled: vi.fn(),
      },
      status: ComponentStatus.Active,
    };

    expect('state' in definition).toBe(true);
    expect(definition.state).toEqual({ confirmed: true });
  });
});
