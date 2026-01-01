import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Static } from 'ink';

import {
  BaseState,
  ComponentDefinition,
  ComponentStatus,
  ManagedComponentDefinition,
} from '../types/components.js';
import { LifecycleHandlers, WorkflowHandlers } from '../types/handlers.js';
import { ComponentName, FeedbackType } from '../types/types.js';

import { createFeedback } from '../services/components.js';
import { DebugLevel } from '../configuration/types.js';
import { getWarnings } from '../services/logger.js';
import { getCancellationMessage } from '../services/messages.js';
import { exitApp } from '../services/process.js';

import {
  SimpleComponent,
  ControllerComponent,
  TimelineComponent,
} from './Component.js';

/**
 * Mark a component as done. Returns the component to be added to timeline.
 * Components use handlers.updateState to save their state before completion,
 * so this function sets the status to Done and returns the updated component.
 */
function markAsDone(component: ComponentDefinition): ComponentDefinition {
  return { ...component, status: ComponentStatus.Done };
}

interface WorkflowProps {
  initialQueue: ComponentDefinition[];
  debug: DebugLevel;
}

export const Workflow = ({ initialQueue, debug }: WorkflowProps) => {
  const [timeline, setTimeline] = useState<ComponentDefinition[]>([]);
  const [current, setCurrent] = useState<{
    active: ComponentDefinition | null;
    pending: ComponentDefinition | null;
  }>({ active: null, pending: null });
  const [queue, setQueue] = useState<ComponentDefinition[]>(initialQueue);

  // Function to move active to pending (component just completed)
  const moveActiveToPending = useCallback(() => {
    setCurrent((curr) => {
      const { active } = curr;
      if (!active) return curr;

      // Move active to pending without marking as done
      const pendingComponent = { ...active, status: ComponentStatus.Pending };
      return { active: null, pending: pendingComponent };
    });
  }, []);

  // Function to move active directly to timeline (error/abort)
  const moveActiveToTimeline = useCallback(() => {
    setCurrent((curr) => {
      const { active, pending } = curr;
      if (!active) return curr;

      // Mark as done and add to timeline
      const doneComponent = markAsDone(active);
      setTimeline((prev) => [...prev, doneComponent]);
      return { active: null, pending };
    });
  }, []);

  // Request handlers - manages errors, aborts, and completions
  const requestHandlers = useMemo(
    () => ({
      onError: (error: string) => {
        moveActiveToTimeline();
        // Add feedback to queue
        setQueue((queue) => [
          ...queue,
          createFeedback({ type: FeedbackType.Failed, message: error }),
        ]);
      },
      onAborted: (operation: string) => {
        moveActiveToTimeline();
        // Clear queue and add only feedback to prevent subsequent components from executing
        const message = getCancellationMessage(operation);
        setQueue([createFeedback({ type: FeedbackType.Aborted, message })]);
      },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
      onCompleted: <T extends BaseState>(finalState: T) => {
        setCurrent((curr) => {
          const { active, pending } = curr;
          if (!active || !('state' in active)) return curr;

          // Save final state to definition
          const managed = active as ManagedComponentDefinition;
          const updated = {
            ...managed,
            state: finalState,
          } as ComponentDefinition;

          return { active: updated, pending };
        });
      },
    }),
    [moveActiveToTimeline]
  );

  // Lifecycle handlers - for components with active/pending states
  const lifecycleHandlers = useMemo<LifecycleHandlers<ComponentDefinition>>(
    () => ({
      completeActive: (...items: ComponentDefinition[]) => {
        moveActiveToPending();
        if (items.length > 0) {
          setQueue((queue) => [...items, ...queue]);
        }
      },
      completeActiveAndPending: (...items: ComponentDefinition[]) => {
        setCurrent((curr) => {
          const { active, pending } = curr;

          // Move both to timeline - pending first (Plan), then active (Confirm)
          if (pending) {
            const donePending = markAsDone(pending);
            setTimeline((prev) => [...prev, donePending]);
          }
          if (active) {
            const doneActive = markAsDone(active);
            setTimeline((prev) => [...prev, doneActive]);
          }

          return { active: null, pending: null };
        });

        if (items.length > 0) {
          setQueue((queue) => [...items, ...queue]);
        }
      },
    }),
    [moveActiveToPending]
  );

  // Workflow handlers - manages queue and timeline
  const workflowHandlers = useMemo<WorkflowHandlers<ComponentDefinition>>(
    () => ({
      addToQueue: (...items: ComponentDefinition[]) => {
        setQueue((queue) => [...queue, ...items]);
      },
      addToTimeline: (...items: ComponentDefinition[]) => {
        setTimeline((prev) => [...prev, ...items]);
      },
    }),
    []
  );

  // Global Esc handler removed - components handle their own Esc individually

  // Move next item from queue to active
  useEffect(() => {
    const { active, pending } = current;

    // Early return: not ready to activate next
    if (queue.length === 0 || active !== null) {
      return;
    }

    const [first, ...rest] = queue;
    const activeComponent = { ...first, status: ComponentStatus.Active };

    // Confirm - keep pending visible (Plan showing what will execute)
    if (first.name === ComponentName.Confirm) {
      setQueue(rest);
      setCurrent({ active: activeComponent, pending });
      return;
    }

    // Other components - move pending to timeline first, then activate
    if (pending) {
      const donePending = markAsDone(pending);
      setTimeline((prev) => [...prev, donePending]);
    }

    setQueue(rest);
    setCurrent({ active: activeComponent, pending: null });
  }, [queue, current]);

  // Process active component - stateless components auto-move to timeline
  useEffect(() => {
    const { active, pending } = current;
    if (!active) return;

    if (isSimple(active)) {
      // Simple components move directly to timeline
      const doneComponent = markAsDone(active);
      setTimeline((prev) => [...prev, doneComponent]);
      setCurrent({ active: null, pending });
    }
    // Managed components stay in active until handlers move them to pending
  }, [current]);

  // Check for accumulated warnings and add them to timeline
  useEffect(() => {
    const warningMessages = getWarnings();
    if (warningMessages.length > 0) {
      const warningComponents = warningMessages.map((msg) =>
        createFeedback(
          { type: FeedbackType.Warning, message: msg },
          ComponentStatus.Done
        )
      );
      setTimeline((prev) => [...prev, ...warningComponents]);
    }
  }, [timeline, current]);

  // Move final pending to timeline and exit when all done
  useEffect(() => {
    const { active, pending } = current;

    // Early return: not ready to finish
    if (active !== null || queue.length > 0) {
      return;
    }

    // Handle pending component
    if (pending) {
      const donePending = markAsDone(pending);
      setTimeline((prev) => [...prev, donePending]);
      setCurrent({ active: null, pending: null });
      return;
    }

    // Early return: nothing to exit with
    if (timeline.length === 0) {
      return;
    }

    // Everything is done, exit
    const lastItem = timeline[timeline.length - 1];
    const isFailed =
      lastItem.name === ComponentName.Feedback &&
      lastItem.props.type === FeedbackType.Failed;

    exitApp(isFailed ? 1 : 0);
  }, [current, queue, timeline]);

  // Render component with handlers (used for both active and pending)
  const renderComponent = useCallback(
    (def: ComponentDefinition | null, status: ComponentStatus) => {
      if (!def) return null;

      // For simple components, render as-is
      if (isSimple(def)) {
        return <SimpleComponent key={def.id} def={def} />;
      }

      // For managed components, inject handlers via ControllerComponent
      return (
        <ControllerComponent
          key={def.id}
          def={{ ...def, status } as ManagedComponentDefinition}
          debug={debug}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={workflowHandlers}
        />
      );
    },
    [debug, requestHandlers, lifecycleHandlers, workflowHandlers]
  );

  const activeComponent = useMemo(
    () => renderComponent(current.active, ComponentStatus.Active),
    [current.active, renderComponent]
  );
  const pendingComponent = useMemo(
    () => renderComponent(current.pending, ComponentStatus.Pending),
    [current.pending, renderComponent]
  );

  return (
    <Box flexDirection="column">
      {/* Timeline - finished, never re-renders */}
      <Static key="timeline" items={timeline}>
        {(item) => (
          <Box key={item.id} marginTop={1}>
            <TimelineComponent def={item} />
          </Box>
        )}
      </Static>

      {/* Current - pending and active together */}
      {pendingComponent && <Box marginTop={1}>{pendingComponent}</Box>}
      {activeComponent && <Box marginTop={1}>{activeComponent}</Box>}
    </Box>
  );
};

/**
 * Check if a component is stateless (simple).
 * Stateless components are display-only and complete immediately without
 * tracking internal state. Stateful components manage user interaction
 * and maintain state across their lifecycle.
 */
export function isSimple(component: ComponentDefinition): boolean {
  return !('state' in component);
}
