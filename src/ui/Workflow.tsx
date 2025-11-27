import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [active, setActive] = useState<ComponentDefinition | null>(null);
  const [queue, setQueue] = useState<ComponentDefinition[]>(initialQueue);

  // Function to move active component to timeline
  const moveActiveToTimeline = useCallback(() => {
    setActive((curr) => {
      if (!curr) return null;

      const doneComponent = markAsDone(curr);
      setTimeline((prev) => [...prev, doneComponent]);
      return null;
    });
  }, []);

  // Global handlers for all stateful components
  const handlers: Handlers = useMemo(
    () => ({
      onComplete: () => {
        moveActiveToTimeline();
      },
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
      completeActive: () => {
        moveActiveToTimeline();
      },
      updateState: <T extends BaseState>(newState: Partial<T>) => {
        setActive((curr) => {
          if (!curr || !('state' in curr)) return curr;
          const stateful = curr as StatefulComponentDefinition;
          return {
            ...stateful,
            state: {
              ...stateful.state,
              ...newState,
            },
          } as ComponentDefinition;
        });
      },
    }),
    [moveActiveToTimeline]
  );

  // Global Esc handler removed - components handle their own Esc individually

  // Move next item from queue to active
  useEffect(() => {
    if (queue.length > 0 && active === null) {
      const [first, ...rest] = queue;
      setQueue(rest);
      setActive(first);
    }
  }, [queue, active]);

  // Process active component - stateless components auto-move to timeline
  useEffect(() => {
    if (!active) return;

    if (isStateless(active)) {
      const doneComponent = markAsDone(active);
      setTimeline((prev) => [...prev, doneComponent]);
      setActive(null);
    }
    // Stateful components stay in active until handlers move them to timeline
  }, [active]);

  // Exit when all done
  useEffect(() => {
    if (active === null && queue.length === 0 && timeline.length > 0) {
      // Check if last item in timeline is a failed feedback
      const lastItem = timeline[timeline.length - 1];
      const isFailed =
        lastItem.name === ComponentName.Feedback &&
        lastItem.props.type === FeedbackType.Failed;

      exitApp(isFailed ? 1 : 0);
    }
  }, [active, queue, timeline]);

  // Inject global handlers into active component
  const activeComponent = useMemo(() => {
    if (!active) return null;

    // For stateless components, render as-is with isActive=true
    if (isStateless(active)) {
      return (
        <Component key={active.id} def={active} isActive={true} debug={debug} />
      );
    }

    // For stateful components, inject global handlers
    const statefulActive = active as StatefulComponentDefinition;
    const wrappedDef: ComponentDefinition = {
      ...statefulActive,
      props: {
        ...statefulActive.props,
        handlers,
      },
    } as ComponentDefinition;

    return (
      <Component
        key={active.id}
        def={wrappedDef}
        isActive={true}
        debug={debug}
      />
    );
  }, [active, debug, handlers]);

  return (
    <Box flexDirection="column">
      <Static key="timeline" items={timeline}>
        {(item) => (
          <Box key={item.id} marginTop={1}>
            <Component def={item} isActive={false} debug={debug} />
          </Box>
        )}
      </Static>
      <Box marginTop={1}>{activeComponent}</Box>
    </Box>
  );
};
