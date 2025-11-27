import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { CommandProps } from '../types/components.js';
import { Task, TaskType } from '../types/types.js';

import { Colors } from '../services/colors.js';
import {
  createAnswerDefinition,
  createConfirmDefinition,
  createExecuteDefinition,
  createIntrospectDefinition,
  createPlanDefinition,
} from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';
import { UserQuery } from './UserQuery.js';

const MIN_PROCESSING_TIME = 1000; // purely for visual effect

export function Command({
  command,
  state,
  isActive = true,
  service,
  children,
  handlers,
}: CommandProps) {
  const [error, setError] = useState<string | null>(null);

  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        handlers?.onAborted?.('request');
      }
    },
    { isActive }
  );

  useEffect(() => {
    // Skip processing if not active (showing historical/final state)
    if (!isActive) {
      return;
    }

    // Skip processing if no service available
    if (!service) {
      setError('No service available');
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        let result = await svc!.processWithTool(command, 'plan');

        // If all tasks are config type, delegate to CONFIG tool
        const allConfig =
          result.tasks.length > 0 &&
          result.tasks.every((task) => task.type === TaskType.Config);

        if (allConfig) {
          // Extract query from first config task params, default to 'app'
          const query =
            (result.tasks[0].params?.query as string | undefined) || 'app';
          // Call CONFIG tool to get specific config keys
          result = await svc!.processWithTool(query, 'config');
        }

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Save result to state for timeline display
          if (state) {
            state.message = result.message;
            state.tasks = result.tasks;
          }

          // Add Plan component to queue if we have tasks, handlers, and service
          if (result.tasks.length > 0 && handlers?.addToQueue && service) {
            const { addToQueue, onComplete, onAborted } = handlers;

            const handleConfirmed = (refinedTasks: Task[]) => {
              // Check task types and route to appropriate handler
              const taskTypes = refinedTasks.map((t) => t.type);
              const allIntrospect = taskTypes.every(
                (type) => type === TaskType.Introspect
              );
              const allAnswer = taskTypes.every(
                (type) => type === TaskType.Answer
              );
              const allExecute = taskTypes.every(
                (type) => type === TaskType.Execute
              );

              const onConfirmed = () => {
                if (allIntrospect) {
                  // Execute introspection
                  addToQueue(
                    createIntrospectDefinition(refinedTasks, service)
                  );
                } else if (allAnswer) {
                  // Execute answer
                  const question = refinedTasks[0].action;
                  addToQueue(createAnswerDefinition(question, service));
                } else if (allExecute) {
                  // Execute tasks
                  addToQueue(
                    createExecuteDefinition(refinedTasks, service)
                  );
                }

                onComplete();
              };

              const onCancelled = () => {
                onAborted('confirmation');
              };

              addToQueue(createConfirmDefinition(onConfirmed, onCancelled));
            };

            addToQueue(
              createPlanDefinition(result.message, result.tasks, handleConfirmed)
            );
          }

          // Signal completion after adding to queue
          handlers?.onComplete?.();
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);
          handlers?.onError?.(errorMessage);
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [command, isActive, service]);

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {!isActive ? (
        <UserQuery>&gt; pls {command}</UserQuery>
      ) : (
        <Box marginLeft={1}>
          <Text color={Colors.Text.Active}>&gt; pls {command}</Text>
          <Text> </Text>
          <Spinner />
        </Box>
      )}

      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}

      {children && <Box marginLeft={1}>{children}</Box>}
    </Box>
  );
}
