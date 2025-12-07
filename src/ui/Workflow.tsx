import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Static, Text } from 'ink';

import {
  BaseState,
  ComponentDefinition,
  ComponentStatus,
  Handlers,
  StatefulComponentDefinition,
} from '../types/components.js';
import { ComponentName, FeedbackType } from '../types/types.js';

import {
  createFeedback,
  isStateless,
  markAsDone,
} from '../services/components.js';
import { exitApp } from '../services/process.js';
import { getCancellationMessage } from '../services/messages.js';

import { Component } from './Component.js';

interface WorkflowProps {
  initialQueue: ComponentDefinition[];
  debug: boolean;
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

  // Global handlers for all stateful components
  const handlers: Handlers = useMemo(
    () => ({
      addToQueue: (...items: ComponentDefinition[]) => {
        setQueue((queue) => [...queue, ...items]);
      },
      updateState: <T extends BaseState>(newState: Partial<T>) => {
        setCurrent((curr) => {
          const { active, pending } = curr;
          if (!active || !('state' in active)) return curr;

          const stateful = active as StatefulComponentDefinition;
          const updated = {
            ...stateful,
            state: {
              ...stateful.state,
              ...newState,
            },
          } as ComponentDefinition;

          return { active: updated, pending };
        });
      },
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
      addToTimeline: (...items: ComponentDefinition[]) => {
        setTimeline((prev) => [...prev, ...items]);
      },
      onAborted: (operation: string) => {
        moveActiveToTimeline();
        // Add feedback to queue
        const message = getCancellationMessage(operation);
        setQueue((queue) => [
          ...queue,
          createFeedback(FeedbackType.Aborted, message),
        ]);
      },
      onError: (error: string) => {
        moveActiveToTimeline();
        // Add feedback to queue
        setQueue((queue) => [
          ...queue,
          createFeedback(FeedbackType.Failed, error),
        ]);
      },
    }),
    [moveActiveToPending, moveActiveToTimeline]
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

    if (isStateless(active)) {
      // Stateless components move directly to timeline
      const doneComponent = markAsDone(active);
      setTimeline((prev) => [...prev, doneComponent]);
      setCurrent({ active: null, pending });
    }
    // Stateful components stay in active until handlers move them to pending
  }, [current]);

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

  // Render active and pending components
  const activeComponent = useMemo(() => {
    const { active } = current;
    if (!active) return null;

    // For stateless components, render as-is
    if (isStateless(active)) {
      return <Component key={active.id} def={active} debug={debug} />;
    }

    // For stateful components, inject global handlers
    const statefulActive = active as StatefulComponentDefinition;
    const wrappedDef = {
      ...statefulActive,
      props: {
        ...statefulActive.props,
        handlers,
      },
    } as unknown as ComponentDefinition;

    return <Component key={active.id} def={wrappedDef} debug={debug} />;
  }, [current, debug, handlers]);

  const pendingComponent = useMemo(() => {
    const { pending } = current;
    if (!pending) return null;

    // Pending components don't receive input
    return <Component key={pending.id} def={pending} debug={debug} />;
  }, [current, debug]);

  return (
    <Box flexDirection="column">
      {/* Timeline - finished, never re-renders */}
      <Static key="timeline" items={timeline}>
        {(item) => (
          <Box key={item.id} marginTop={1}>
            <Component def={item} debug={false} />
          </Box>
        )}
      </Static>

      {/* Current - pending and active together */}
      {pendingComponent && <Box marginTop={1}>{pendingComponent}</Box>}
      {activeComponent && <Box marginTop={1}>{activeComponent}</Box>}
    </Box>
  );
};
