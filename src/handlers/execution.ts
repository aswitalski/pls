import {
  Capability,
  StatefulComponentDefinition,
} from '../types/components.js';
import {
  AnswerHandlers,
  ExecuteHandlers,
  ExecutionHandlers,
  HandlerOperations,
  IntrospectHandlers,
} from '../types/handlers.js';
import { ComponentName, FeedbackType, Task, TaskType } from '../types/types.js';

import {
  createAnswerDefinition,
  createConfigDefinitionWithKeys,
  createExecuteDefinition,
  createFeedback,
  createIntrospectDefinition,
  markAsDone,
} from '../services/components.js';
import { getCancellationMessage } from '../services/messages.js';
import { exitApp } from '../services/process.js';
import { withQueueHandler } from '../services/queue.js';
import {
  createConfigExecutionAbortedHandler,
  createConfigExecutionFinishedHandler,
} from './config.js';

/**
 * Task type handlers for execution
 */
interface TaskHandlers {
  introspect: IntrospectHandlers;
  answer: AnswerHandlers;
  execute: ExecuteHandlers;
}

/**
 * Creates all execution handlers
 */
export function createExecutionHandlers(
  ops: HandlerOperations,
  taskHandlers: TaskHandlers
): ExecutionHandlers {
  const onConfirmed = (tasks: Task[]) => {
    ops.setQueue(
      withQueueHandler(ComponentName.Confirm, (first) => {
        const allIntrospect = tasks.every(
          (task) => task.type === TaskType.Introspect
        );
        const allAnswer = tasks.every((task) => task.type === TaskType.Answer);
        const allConfig = tasks.every((task) => task.type === TaskType.Config);
        const allExecute = tasks.every(
          (task) => task.type === TaskType.Execute
        );

        const service = ops.service;
        if (!service) {
          ops.addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(FeedbackType.Failed, 'Service not available')
          );
          exitApp(1);
          return [];
        }

        if (allIntrospect && tasks.length > 0) {
          ops.addToTimeline(markAsDone(first as StatefulComponentDefinition));
          return [
            createIntrospectDefinition(
              tasks,
              service,
              taskHandlers.introspect.onError,
              taskHandlers.introspect.onComplete,
              taskHandlers.introspect.onAborted
            ),
          ];
        } else if (allAnswer && tasks.length > 0) {
          const question = tasks[0].action;
          ops.addToTimeline(markAsDone(first as StatefulComponentDefinition));
          return [
            createAnswerDefinition(
              question,
              service,
              taskHandlers.answer.onError,
              taskHandlers.answer.onComplete,
              taskHandlers.answer.onAborted
            ),
          ];
        } else if (allConfig && tasks.length > 0) {
          const keys = tasks
            .map((task) => task.params?.key as string | undefined)
            .filter((key): key is string => typeof key === 'string');
          ops.addToTimeline(markAsDone(first as StatefulComponentDefinition));

          const handleConfigFinished = (config: Record<string, string>) => {
            ops.setQueue(
              createConfigExecutionFinishedHandler(
                ops.addToTimeline,
                keys
              )(config)
            );
          };
          const handleConfigAborted = () => {
            ops.setQueue(
              createConfigExecutionAbortedHandler(ops.addToTimeline)()
            );
          };

          return [
            createConfigDefinitionWithKeys(
              keys,
              handleConfigFinished,
              handleConfigAborted
            ),
          ];
        } else if (allExecute && tasks.length > 0) {
          ops.addToTimeline(markAsDone(first as StatefulComponentDefinition));
          return [
            createExecuteDefinition(
              tasks,
              service,
              taskHandlers.execute.onError,
              taskHandlers.execute.onComplete,
              taskHandlers.execute.onAborted
            ),
          ];
        } else {
          ops.addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(
              FeedbackType.Failed,
              'I can only process one type of task at a time for now.'
            )
          );
          exitApp(0);
          return [];
        }
      })
    );
  };

  const onCancelled = (tasks: Task[]) => {
    ops.setQueue(
      withQueueHandler(
        ComponentName.Confirm,
        (first) => {
          const allIntrospect = tasks.every(
            (task) => task.type === TaskType.Introspect
          );

          const operation = allIntrospect ? 'introspection' : 'execution';

          ops.addToTimeline(
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
      )
    );
  };

  return { onConfirmed, onCancelled };
}

// Re-export types for convenience
export type { Capability };
