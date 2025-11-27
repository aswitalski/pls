import React from 'react';
import { Box, Static } from 'ink';

import {
  ComponentDefinition,
  Handlers,
  StatefulComponentDefinition,
} from '../types/components.js';
import { FeedbackType } from '../types/types.js';

import {
  createFeedback,
  isStateless,
  markAsDone,
} from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import { exitApp } from '../services/process.js';

import { Component } from './Component.js';

interface WorkflowProps {
  initialQueue: ComponentDefinition[];
  debug: boolean;
}

export const Workflow = ({ initialQueue, debug }: WorkflowProps) => {
  const [timeline, setTimeline] = React.useState<ComponentDefinition[]>([]);
  const [active, setActive] = React.useState<ComponentDefinition | null>(null);
  const [queue, setQueue] = React.useState<ComponentDefinition[]>(initialQueue);

  // Function to move active component to timeline
  const moveActiveToTimeline = React.useCallback(() => {
    setActive((curr) => {
      if (!curr) return null;

      const doneComponent = markAsDone(curr);
      setTimeline((prev) => [...prev, doneComponent]);
      return null;
    });
  }, []);

  // Global handlers for all stateful components
  const handlers: Handlers = React.useMemo(
    () => ({
      onComplete: () => {
        moveActiveToTimeline();
      },
      onAborted: (operation: string) => {
        moveActiveToTimeline();
        // Add feedback to queue and exit
        const message = `The ${operation} was cancelled.`;
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
      updateState: (newState: Partial<any>) => {
        setActive((curr) => {
          if (!curr || !('state' in curr)) return curr;
          return {
            ...curr,
            state: {
              ...curr.state,
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
  React.useEffect(() => {
    if (queue.length > 0 && active === null) {
      const [first, ...rest] = queue;
      setQueue(rest);
      setActive(first);
    }
  }, [queue, active]);

  // Process active component - stateless components auto-move to timeline
  React.useEffect(() => {
    if (!active) return;

    if (isStateless(active)) {
      const doneComponent = markAsDone(active);
      setTimeline((prev) => [...prev, doneComponent]);
      setActive(null);
    }
    // Stateful components stay in active until handlers move them to timeline
  }, [active]);

  // Exit when all done
  React.useEffect(() => {
    if (active === null && queue.length === 0 && timeline.length > 0) {
      // Check if last item in timeline is a failed feedback
      const lastItem = timeline[timeline.length - 1];
      if (
        lastItem.name === 'feedback' &&
        'type' in lastItem.props &&
        lastItem.props.type === FeedbackType.Failed
      ) {
        exitApp(1);
      } else {
        exitApp(0);
      }
    }
  }, [active, queue, timeline]);

  // Inject global handlers into active component
  const activeComponent = React.useMemo(() => {
    if (!active) return null;

    // For stateless components, render as-is with done=false
    if (isStateless(active)) {
      return (
        <Component key={active.id} def={active} done={false} debug={debug} />
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
      <Component key={active.id} def={wrappedDef} done={false} debug={debug} />
    );
  }, [active, debug, handlers]);

  return (
    <Box flexDirection="column">
      <Static key="timeline" items={timeline}>
        {(item) => (
          <Box key={item.id} marginTop={1}>
            <Component def={item} done={true} debug={debug} />
          </Box>
        )}
      </Static>
      <Box marginTop={1}>{activeComponent}</Box>
    </Box>
  );
};
