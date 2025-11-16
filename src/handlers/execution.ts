import {
  Capability,
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { ComponentName, FeedbackType, TaskType } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';
import {
  createAnswerDefinition,
  createFeedback,
  createIntrospectDefinition,
  markAsDone,
} from '../services/components.js';
import { getCancellationMessage } from '../services/messages.js';
import { exitApp } from '../services/process.js';
import { withQueueHandler } from '../services/queue.js';

/**
 * Creates execution confirmed handler
 */
export function createExecutionConfirmedHandler(
  timelineRef: { readonly current: ComponentDefinition[] },
  addToTimeline: (...items: ComponentDefinition[]) => void,
  service: LLMService,
  handleIntrospectError: (error: string) => void,
  handleIntrospectComplete: (
    message: string,
    capabilities: Capability[]
  ) => void,
  handleIntrospectAborted: () => void,
  handleAnswerError: (error: string) => void,
  handleAnswerComplete: (answer: string) => void,
  handleAnswerAborted: () => void
) {
  return () =>
    withQueueHandler(ComponentName.Confirm, (first) => {
      // Find the most recent Plan in timeline to get tasks
      const currentTimeline = timelineRef.current;
      const lastPlanIndex = [...currentTimeline]
        .reverse()
        .findIndex((item) => item.name === ComponentName.Plan);
      const lastPlan =
        lastPlanIndex >= 0
          ? currentTimeline[currentTimeline.length - 1 - lastPlanIndex]
          : null;

      const tasks =
        lastPlan?.name === ComponentName.Plan &&
        Array.isArray(lastPlan.props.tasks)
          ? lastPlan.props.tasks
          : [];

      const allIntrospect = tasks.every(
        (task) => task.type === TaskType.Introspect
      );

      const allAnswer = tasks.every((task) => task.type === TaskType.Answer);

      if (allIntrospect && tasks.length > 0) {
        // Execute introspection
        addToTimeline(markAsDone(first as StatefulComponentDefinition));
        return [
          createIntrospectDefinition(
            tasks,
            service,
            handleIntrospectError,
            handleIntrospectComplete,
            handleIntrospectAborted
          ),
        ];
      } else if (allAnswer && tasks.length > 0) {
        // Execute answer - extract question from first task
        const question = tasks[0].action;
        addToTimeline(markAsDone(first as StatefulComponentDefinition));
        return [
          createAnswerDefinition(
            question,
            service,
            handleAnswerError,
            handleAnswerComplete,
            handleAnswerAborted
          ),
        ];
      } else {
        // Regular execution - just exit for now
        addToTimeline(markAsDone(first as StatefulComponentDefinition));
        exitApp(0);
        return [];
      }
    });
}

/**
 * Creates execution cancelled handler
 */
export function createExecutionCancelledHandler(
  timelineRef: { readonly current: ComponentDefinition[] },
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return () =>
    withQueueHandler(
      ComponentName.Confirm,
      (first) => {
        // Find the most recent Plan in timeline to check task types
        const currentTimeline = timelineRef.current;
        const lastPlanIndex = [...currentTimeline]
          .reverse()
          .findIndex((item) => item.name === ComponentName.Plan);
        const lastPlan =
          lastPlanIndex >= 0
            ? currentTimeline[currentTimeline.length - 1 - lastPlanIndex]
            : null;

        const allIntrospect =
          lastPlan?.name === ComponentName.Plan &&
          Array.isArray(lastPlan.props.tasks) &&
          lastPlan.props.tasks.every(
            (task) => task.type === TaskType.Introspect
          );

        const operation = allIntrospect ? 'introspection' : 'execution';

        addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(
            FeedbackType.Aborted,
            getCancellationMessage(operation)
          )
        );
        return undefined;
      },
      true,
      0
    );
}
