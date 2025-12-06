import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Static } from 'ink';

import {
  BaseState,
  ComponentDefinition,
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

  // Ref to track current components for synchronous access
  const currentRef = useRef<{
    active: ComponentDefinition | null;
    pending: ComponentDefinition | null;
  }>({ active: null, pending: null });

  // Keep ref in sync with current state
  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  // Function to move active and pending components to timeline with optional additional items
  const moveActiveToTimeline = useCallback(
    (...items: ComponentDefinition[]) => {
      const { active, pending } = currentRef.current;

      // Move pending to timeline if exists
      if (pending) {
        const doneComponent = markAsDone(pending);
        setTimeline((prev) => [...prev, doneComponent]);
      }

      // Move active to timeline
      if (active) {
        const doneComponent = markAsDone(active);
        setTimeline((prev) =>
          items.length > 0
            ? [...prev, doneComponent, ...items]
            : [...prev, doneComponent]
        );
      } else if (!pending && items.length > 0) {
        // No active or pending, just add items
        setTimeline((prev) => [...prev, ...items]);
      }

      // Clear current group
      setCurrent({ active: null, pending: null });
    },
    []
  );

  // Global handlers for all stateful components
  const handlers: Handlers = useMemo(
    () => ({
      onAborted: (operation: string) => {
        moveActiveToTimeline();
        // Add feedback to queue and exit
        const message = getCancellationMessage(operation);
        setQueue((queue) => [
          ...queue,
          createFeedback(FeedbackType.Aborted, message),
        ]);
      },
      onError: (error: string) => {
        moveActiveToTimeline();
        // Add feedback to queue and exit with error code
        setQueue((queue) => [
          ...queue,
          createFeedback(FeedbackType.Failed, error),
        ]);
      },
      addToQueue: (...items: ComponentDefinition[]) => {
        setQueue((queue) => [...queue, ...items]);
      },
      addToTimeline: (...items: ComponentDefinition[]) => {
        setTimeline((prev) => [...prev, ...items]);
      },
      moveToPending: () => {
        const { active } = currentRef.current;
        if (!active) return;

        // Move active to pending without marking as done
        setCurrent({ active: null, pending: active });
      },
      completeActive: (...items: ComponentDefinition[]) => {
        moveActiveToTimeline(...items);
      },
      updateState: <T extends BaseState>(newState: Partial<T>) => {
        setCurrent((curr) => {
          const { active } = curr;
          if (!active || !('state' in active)) return curr;
          const stateful = active as StatefulComponentDefinition;
          const updated = {
            ...stateful,
            state: {
              ...stateful.state,
              ...newState,
            },
          } as ComponentDefinition;

          // Update ref synchronously so moveActiveToTimeline sees the latest state
          const newCurrent = { ...curr, active: updated };
          currentRef.current = newCurrent;

          return newCurrent;
        });
      },
    }),
    [moveActiveToTimeline]
  );

  // Global Esc handler removed - components handle their own Esc individually

  // Move next item from queue to active
  useEffect(() => {
    if (queue.length > 0 && current.active === null) {
      const [first, ...rest] = queue;
      setQueue(rest);
      setCurrent((prev) => ({ ...prev, active: first }));
    }
  }, [queue, current.active]);

  // Process active component - stateless components auto-move to timeline
  useEffect(() => {
    const { active } = current;
    if (!active) return;

    if (isStateless(active)) {
      const doneComponent = markAsDone(active);
      setTimeline((prev) => [...prev, doneComponent]);
      setCurrent((prev) => ({ ...prev, active: null }));
    }
    // Stateful components stay in active until handlers move them to timeline
  }, [current]);

  // Exit when all done
  useEffect(() => {
    if (
      current.active === null &&
      current.pending === null &&
      queue.length === 0 &&
      timeline.length > 0
    ) {
      // Check if last item in timeline is a failed feedback
      const lastItem = timeline[timeline.length - 1];
      const isFailed =
        lastItem.name === ComponentName.Feedback &&
        lastItem.props.type === FeedbackType.Failed;

      exitApp(isFailed ? 1 : 0);
    }
  }, [current.active, current.pending, queue, timeline]);

  // Render active and pending components
  const activeComponent = useMemo(() => {
    const { active } = current;
    if (!active) return null;

    // For stateless components, render as-is with isActive=true
    if (isStateless(active)) {
      return (
        <Component key={active.id} def={active} isActive={true} debug={debug} />
      );
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

    return (
      <Component
        key={active.id}
        def={wrappedDef}
        isActive={true}
        debug={debug}
      />
    );
  }, [current, debug, handlers]);

  const pendingComponent = useMemo(() => {
    const { pending } = current;
    if (!pending) return null;

    // Pending components don't receive input, so isActive=false
    return (
      <Component
        key={pending.id}
        def={pending}
        isActive={false}
        debug={debug}
      />
    );
  }, [current, debug]);

  return (
    <Box flexDirection="column">
      {/* Timeline: Only Done components (Static, never re-renders) */}
      <Static key="timeline" items={timeline}>
        {(item) => (
          <Box key={item.id} marginTop={1}>
            <Component def={item} isActive={false} debug={false} />
          </Box>
        )}
      </Static>

      {/* Current work: Pending + Active together (dynamic) */}
      {pendingComponent && <Box marginTop={1}>{pendingComponent}</Box>}
      {activeComponent && <Box marginTop={1}>{activeComponent}</Box>}
    </Box>
  );
};
