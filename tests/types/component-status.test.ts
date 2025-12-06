import { describe, expect, it, vi } from 'vitest';

import {
  ComponentStatus,
  Handlers,
  BaseRuntimeProps,
  BaseState,
  ComponentDefinition,
} from '../../src/types/components.js';
import { ComponentName } from '../../src/types/types.js';

describe('ComponentStatus enum', () => {
  it('defines all four lifecycle states', () => {
    expect(ComponentStatus.Awaiting).toBe('awaiting');
    expect(ComponentStatus.Active).toBe('active');
    expect(ComponentStatus.Pending).toBe('pending');
    expect(ComponentStatus.Done).toBe('done');
  });

  it('enum values are unique', () => {
    const values = Object.values(ComponentStatus);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

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
          isDebug: false,
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

describe('Handlers interface', () => {
  it('includes moveToPending handler', () => {
    const handlers: Handlers = {
      onAborted: vi.fn(),
      onError: vi.fn(),
      addToQueue: vi.fn(),
      addToTimeline: vi.fn(),
      moveToPending: vi.fn(),
      completeActive: vi.fn(),
      updateState: vi.fn(),
    };

    expect(handlers.moveToPending).toBeDefined();
    expect(typeof handlers.moveToPending).toBe('function');
  });

  it('moveToPending handler is callable', () => {
    const moveToPending = vi.fn();
    const handlers: Handlers = {
      onAborted: vi.fn(),
      onError: vi.fn(),
      addToQueue: vi.fn(),
      addToTimeline: vi.fn(),
      moveToPending,
      completeActive: vi.fn(),
      updateState: vi.fn(),
    };

    handlers.moveToPending();
    expect(moveToPending).toHaveBeenCalledOnce();
  });
});

describe('BaseRuntimeProps with status', () => {
  it('includes optional status field', () => {
    const props: BaseRuntimeProps = {
      status: ComponentStatus.Active,
      isActive: true,
    };

    expect(props.status).toBe(ComponentStatus.Active);
  });

  it('allows status without isActive', () => {
    const props: BaseRuntimeProps = {
      status: ComponentStatus.Pending,
    };

    expect(props.status).toBe(ComponentStatus.Pending);
    expect(props.isActive).toBeUndefined();
  });

  it('allows both status and isActive for migration', () => {
    const props: BaseRuntimeProps = {
      status: ComponentStatus.Active,
      isActive: true,
    };

    expect(props.status).toBe(ComponentStatus.Active);
    expect(props.isActive).toBe(true);
  });

  it('allows isActive without status for backward compatibility', () => {
    const props: BaseRuntimeProps = {
      isActive: true,
    };

    expect(props.isActive).toBe(true);
    expect(props.status).toBeUndefined();
  });
});

describe('Component lifecycle transitions', () => {
  it('represents full lifecycle with status enum', () => {
    // Component starts as Awaiting
    let status: ComponentStatus = ComponentStatus.Awaiting;
    expect(status).toBe('awaiting');

    // Moves to Active when dequeued
    status = ComponentStatus.Active;
    expect(status).toBe('active');

    // Can move to Pending while awaiting user decision
    status = ComponentStatus.Pending;
    expect(status).toBe('pending');

    // Finally moves to Done
    status = ComponentStatus.Done;
    expect(status).toBe('done');
  });

  it('allows direct transition from Active to Done', () => {
    let status: ComponentStatus = ComponentStatus.Active;
    expect(status).toBe('active');

    // Can skip Pending and go directly to Done
    status = ComponentStatus.Done;
    expect(status).toBe('done');
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
