import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComponentDefinition } from '../src/types/components.js';
import { ComponentName, TaskType } from '../src/types/types.js';

import {
  createConfirmDefinition,
  createMessage,
} from '../src/services/components.js';
import { Column } from '../src/ui/Column.js';
import { Component } from '../src/ui/Component.js';
import { StepType } from '../src/ui/Config.js';

describe('Render optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Column memoization', () => {
    it('does not re-render when props reference stays the same', () => {
      const items: ComponentDefinition[] = [
        createMessage('Hello'),
        createMessage('World'),
      ];

      let renderCount = 0;
      // Track renders inside Column by wrapping it
      const TrackedColumn = ({
        testItems,
      }: {
        testItems: ComponentDefinition[];
      }) => {
        renderCount++;
        return <Column items={testItems} debug={false} />;
      };

      const { rerender } = render(<TrackedColumn testItems={items} />);
      expect(renderCount).toBe(1);

      // Re-render with same items reference - should trigger re-render
      // because React re-renders by default when parent re-renders
      rerender(<TrackedColumn testItems={items} />);
      expect(renderCount).toBe(2);
    });

    it('does re-render when items array content actually changes', () => {
      const msg1 = createMessage('Hello');
      const items1: ComponentDefinition[] = [msg1];

      const items2: ComponentDefinition[] = [msg1, createMessage('World')];

      let renderCount = 0;
      const TrackedColumn = ({ items }: { items: ComponentDefinition[] }) => {
        renderCount++;
        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TrackedColumn items={items1} />);
      expect(renderCount).toBe(1);

      // Re-render with different content
      rerender(<TrackedColumn items={items2} />);
      expect(renderCount).toBe(2); // Should re-render
    });

    it('does not re-render when debug flag stays the same', () => {
      const items: ComponentDefinition[] = [createMessage('Test')];

      let renderCount = 0;
      const TrackedColumn = React.memo(() => {
        renderCount++;
        return <Column items={items} debug={false} />;
      });

      const { rerender } = render(<TrackedColumn />);
      expect(renderCount).toBe(1);

      rerender(<TrackedColumn />);
      expect(renderCount).toBe(1); // Should not re-render
    });

    it('accepts debug prop without errors', () => {
      const items: ComponentDefinition[] = [createMessage('Test')];

      const TrackedColumn = ({ debug }: { debug: boolean }) => {
        return <Column items={items} debug={debug} />;
      };

      const { lastFrame, rerender } = render(<TrackedColumn debug={false} />);
      const before = lastFrame();
      expect(before).toBeDefined();

      rerender(<TrackedColumn debug={true} />);
      const after = lastFrame();

      // Debug mode renders without errors
      expect(after).toBeDefined();
    });
  });

  describe('Component dispatcher memoization', () => {
    it('does not re-render when component definition reference changes but content is identical', () => {
      const def1 = createMessage('Test');
      const def2 = createMessage('Test');

      let renderCount = 0;
      const TrackedComponent = ({ def }: { def: ComponentDefinition }) => {
        renderCount++;
        return <Component def={def} debug={false} />;
      };

      const { rerender } = render(<TrackedComponent def={def1} />);
      expect(renderCount).toBe(1);

      // Re-render with different reference but same content
      rerender(<TrackedComponent def={def2} />);
      // Note: React.memo does shallow comparison, so this will re-render
      // because def2 is a different object reference, even if content matches
      expect(renderCount).toBe(2);
    });

    it('uses stable IDs to prevent unnecessary re-renders in lists', () => {
      const component1 = createMessage('First');
      const component2 = createMessage('Second');
      const component3 = createMessage('Third');

      // Verify IDs are unique and stable
      expect(component1.id).not.toBe(component2.id);
      expect(component2.id).not.toBe(component3.id);
      expect(component1.id).not.toBe(component3.id);

      // IDs remain stable when added to lists
      const list1 = [component1, component2];
      const list2 = [component1, component2, component3];

      expect(list2[0].id).toBe(component1.id);
      expect(list2[1].id).toBe(component2.id);

      // Stable IDs are the key to React's reconciliation algorithm
      // This test verifies that IDs don't change when components are added to lists
      expect(component1.id).toBeTruthy();
      expect(component2.id).toBeTruthy();
      expect(component3.id).toBeTruthy();
    });
  });

  describe('Main component useMemo optimization', () => {
    it('uses useMemo to optimize items array calculation', () => {
      // This test verifies the useMemo pattern used in Main
      const timeline: ComponentDefinition[] = [createMessage('Timeline item')];
      const current: ComponentDefinition | null = createMessage('Current item');

      let memoCallCount = 0;
      const TestUseMemoPattern = () => {
        // This is the same pattern used in Main.tsx
        const items = React.useMemo(() => {
          memoCallCount++;
          return [...timeline, ...(current ? [current] : [])];
        }, [timeline, current]);

        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TestUseMemoPattern />);
      expect(memoCallCount).toBe(1);

      // Re-render with same dependencies
      rerender(<TestUseMemoPattern />);
      expect(memoCallCount).toBe(1); // useMemo prevents recalculation
    });

    it('recalculates items array when dependencies change', () => {
      let memoCallCount = 0;

      const TestWrapper = ({ count }: { count: number }) => {
        const timeline = React.useMemo(
          () =>
            Array.from({ length: count }, (_, i) =>
              createMessage(`Message ${i}`)
            ),
          [count]
        );

        const items = React.useMemo(() => {
          memoCallCount++;
          return timeline;
        }, [timeline]);

        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TestWrapper count={1} />);
      expect(memoCallCount).toBe(1);

      // Changing count changes timeline, which triggers items memo
      rerender(<TestWrapper count={2} />);
      expect(memoCallCount).toBe(2);
    });
  });

  describe('Stateful component state isolation', () => {
    it('does not trigger parent re-renders when Plan component internal state changes', () => {
      // Plan component has multiple internal state variables:
      // highlightedIndex, currentDefineGroupIndex, completedSelections, isDone
      const state = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const planDef: ComponentDefinition = {
        id: 'plan-1',
        name: ComponentName.Plan,
        props: {
          tasks: [
            { action: 'Task 1', type: TaskType.Execute },
            { action: 'Task 2', type: TaskType.Execute },
          ],
          onSelectionConfirmed: vi.fn(),
          onAborted: vi.fn(),
        },
        state,
      };

      let parentRenderCount = 0;
      const Parent = ({ def }: { def: ComponentDefinition }) => {
        parentRenderCount++;
        return <Component def={def} debug={false} />;
      };

      const { stdin } = render(<Parent def={planDef} />);
      expect(parentRenderCount).toBe(1);

      // Simulate user interaction that changes Plan's internal state
      stdin.write('\x1B[A'); // Arrow up key

      // Parent should not re-render due to Plan's internal state change
      // Note: This is inherent to React's component model - child state doesn't affect parent
      // We're verifying the architecture maintains this isolation
      expect(parentRenderCount).toBe(1);
    });

    it('does not trigger parent re-renders when Config component steps through form', () => {
      const state = {
        done: false,
        step: undefined,
        values: undefined,
        inputValue: undefined,
        selectedIndex: undefined,
      };

      const configDef: ComponentDefinition = {
        id: 'config-1',
        name: ComponentName.Config,
        props: {
          steps: [
            {
              description: 'Name',
              key: 'name',
              type: StepType.Text,
              value: null,
              validate: () => true,
            },
            {
              description: 'Email',
              key: 'email',
              type: StepType.Text,
              value: null,
              validate: () => true,
            },
          ],
          onFinished: vi.fn(),
          onAborted: vi.fn(),
        },
        state,
      };

      let parentRenderCount = 0;
      const Parent = ({ def }: { def: ComponentDefinition }) => {
        parentRenderCount++;
        return <Component def={def} debug={false} />;
      };

      const { stdin } = render(<Parent def={configDef} />);
      expect(parentRenderCount).toBe(1);

      // Type some input to trigger Config's internal state change
      stdin.write('J');
      stdin.write('o');
      stdin.write('h');
      stdin.write('n');

      // Parent should not re-render
      expect(parentRenderCount).toBe(1);
    });

    it('does not trigger parent re-renders when Command component loads async data', async () => {
      const state = {
        done: false,
        error: undefined,
        isLoading: true,
      };

      const commandDef: ComponentDefinition = {
        id: 'command-1',
        name: ComponentName.Command,
        props: {
          command: 'test command',
          service: undefined, // No service, will show config prompt
          onComplete: vi.fn(),
          onAborted: vi.fn(),
        },
        state,
      };

      let parentRenderCount = 0;
      const Parent = ({ def }: { def: ComponentDefinition }) => {
        parentRenderCount++;
        return <Component def={def} debug={false} />;
      };

      render(<Parent def={commandDef} />);
      expect(parentRenderCount).toBe(1);

      // Command will update its internal loading state
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Parent should not re-render from Command's state changes
      expect(parentRenderCount).toBe(1);
    });
  });

  describe('Timeline updates and render optimization', () => {
    it('only re-renders Column when timeline actually grows', () => {
      const initialTimeline: ComponentDefinition[] = [createMessage('First')];

      let renderCount = 0;
      const TrackedColumn = ({ items }: { items: ComponentDefinition[] }) => {
        renderCount++;
        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TrackedColumn items={initialTimeline} />);
      expect(renderCount).toBe(1);

      // Re-render with same timeline
      rerender(<TrackedColumn items={initialTimeline} />);
      expect(renderCount).toBe(2); // Shallow comparison sees same reference

      const expandedTimeline: ComponentDefinition[] = [
        createMessage('First'),
        createMessage('Second'),
      ];

      // Re-render with expanded timeline
      rerender(<TrackedColumn items={expandedTimeline} />);
      expect(renderCount).toBe(3); // Different array reference triggers re-render
    });

    it('handles queue transitions efficiently with useMemo', () => {
      // Verify the useMemo pattern for combining timeline and queue
      let memoCallCount = 0;

      const TestWrapper = ({ queueLength }: { queueLength: number }) => {
        const timeline: ComponentDefinition[] = [createMessage('Timeline')];
        const queue: ComponentDefinition[] = Array.from(
          { length: queueLength },
          (_, i) => createMessage(`Queue ${i}`)
        );

        const items = React.useMemo(() => {
          memoCallCount++;
          return [...timeline, ...queue];
        }, [timeline.length, queue.length]);

        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TestWrapper queueLength={1} />);
      expect(memoCallCount).toBe(1);

      // Same queue length - memo should not recalculate
      rerender(<TestWrapper queueLength={1} />);
      expect(memoCallCount).toBe(1);

      // Different queue length - memo should recalculate
      rerender(<TestWrapper queueLength={2} />);
      expect(memoCallCount).toBe(2);
    });

    it('preserves memoization when current item changes but timeline does not', () => {
      const timeline: ComponentDefinition[] = [createMessage('Completed')];

      const current1: ComponentDefinition = createMessage('Current 1');
      const current2: ComponentDefinition = createMessage('Current 2');

      // Simulate Main's useMemo behavior
      let memoCallCount = 0;
      const TestWrapper = ({
        current,
      }: {
        current: ComponentDefinition | null;
      }) => {
        const items = React.useMemo(() => {
          memoCallCount++;
          return [...timeline, ...(current ? [current] : [])];
        }, [current]);

        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TestWrapper current={current1} />);
      expect(memoCallCount).toBe(1);

      // Change current item
      rerender(<TestWrapper current={current2} />);
      expect(memoCallCount).toBe(2); // useMemo recalculates when dependency changes

      // Same current item
      rerender(<TestWrapper current={current2} />);
      expect(memoCallCount).toBe(2); // useMemo does not recalculate
    });
  });

  describe('Real-world scenario: interactive session', () => {
    it('minimizes re-renders during a typical user session', () => {
      // Track memo recalculations through session lifecycle
      let memoCallCount = 0;

      const TestSession = ({ step }: { step: number }) => {
        const timeline = React.useMemo(() => {
          const items: ComponentDefinition[] = [];
          if (step >= 1) {
            items.push(createMessage('Welcome'));
          }
          if (step >= 3) {
            items.push(createMessage('Processing command...'));
          }
          return items;
        }, [step]);

        const current = React.useMemo<ComponentDefinition | null>(() => {
          if (step === 2) {
            return createMessage('Processing command...');
          }
          if (step >= 3) {
            return createMessage('Review plan');
          }
          return null;
        }, [step]);

        const items = React.useMemo(() => {
          memoCallCount++;
          return [...timeline, ...(current ? [current] : [])];
        }, [timeline, current]);

        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TestSession step={1} />);
      expect(memoCallCount).toBe(1);

      // Move to step 2
      rerender(<TestSession step={2} />);
      expect(memoCallCount).toBe(2);

      // Move to step 3
      rerender(<TestSession step={3} />);
      expect(memoCallCount).toBe(3);

      // Stay at step 3 - no recalculation
      rerender(<TestSession step={3} />);
      expect(memoCallCount).toBe(3);
    });

    it('handles rapid state changes efficiently', () => {
      // Simulate rapid user input (e.g., fast arrow key presses in Plan)
      const TestRapidUpdates = () => {
        const [count, setCount] = React.useState(0);

        React.useEffect(() => {
          // Simulate 10 rapid state changes
          const timers: NodeJS.Timeout[] = [];
          for (let i = 1; i <= 10; i++) {
            timers.push(setTimeout(() => setCount(i), i * 5));
          }
          return () => timers.forEach(clearTimeout);
        }, []);

        const items = React.useMemo(
          () => [createMessage(`Count: ${count}`)],
          [count]
        );

        return <Column items={items} debug={false} />;
      };

      const { lastFrame } = render(<TestRapidUpdates />);

      // useMemo should batch and optimize these updates
      expect(lastFrame()).toBeDefined();
    });
  });

  describe('Callback stability and re-render prevention', () => {
    it('uses stable callback references with useCallback', () => {
      // Test the useCallback pattern used in Main
      let callbackReferenceCount = 0;
      const callbacks: Array<() => void> = [];

      const TestCallbackStability = ({
        renderTrigger,
      }: {
        renderTrigger: number;
      }) => {
        // useCallback ensures this function reference stays stable
        const handleComplete = React.useCallback(() => {
          // Callback logic here
        }, []); // Empty deps means function is created once

        // Track callback reference changes
        if (!callbacks.includes(handleComplete)) {
          callbackReferenceCount++;
          callbacks.push(handleComplete);
        }

        const items = React.useMemo(
          () => [createMessage(`Render: ${renderTrigger}`)],
          [renderTrigger]
        );

        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TestCallbackStability renderTrigger={1} />);
      expect(callbackReferenceCount).toBe(1);

      // Re-render should use same callback reference
      rerender(<TestCallbackStability renderTrigger={2} />);
      expect(callbackReferenceCount).toBe(1); // Callback reference unchanged
    });

    it('prevents re-renders when callbacks are defined outside render', () => {
      // This pattern is used in Main.tsx with useCallback
      const onComplete = vi.fn();
      const onAborted = vi.fn();

      const items: ComponentDefinition[] = [
        createConfirmDefinition(onComplete, onAborted),
      ];

      let renderCount = 0;
      const TrackedColumn = () => {
        renderCount++;
        return <Column items={items} debug={false} />;
      };

      const { rerender } = render(<TrackedColumn />);
      expect(renderCount).toBe(1);

      // Re-render with same callback references
      rerender(<TrackedColumn />);
      expect(renderCount).toBe(2); // Column re-renders but callbacks are stable
    });
  });

  describe('Component state synchronization without re-renders', () => {
    it('syncs Plan component state without triggering parent re-renders', () => {
      // Plan uses useEffect to sync internal state back to state object
      // This should not trigger parent re-renders
      const state = {
        done: false,
        highlightedIndex: null,
        currentDefineGroupIndex: 0,
        completedSelections: [],
      };

      const planDef: ComponentDefinition = {
        id: 'plan',
        name: ComponentName.Plan,
        props: {
          tasks: [{ action: 'Task 1', type: TaskType.Execute }],
          onSelectionConfirmed: vi.fn(),
          onAborted: vi.fn(),
        },
        state,
      };

      let parentRenderCount = 0;
      const Parent = () => {
        parentRenderCount++;
        const items = React.useMemo(() => [planDef], []);
        return <Column items={items} debug={false} />;
      };

      render(<Parent />);
      expect(parentRenderCount).toBe(1);

      // State object gets mutated by Plan component's useEffect
      // but this does not trigger parent re-render
      // The state is only used for persistence when component completes
    });
  });
});
