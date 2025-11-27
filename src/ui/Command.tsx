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
  createRefinement,
} from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import {
  getRefiningMessage,
  formatErrorMessage,
} from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';
import { UserQuery } from './UserQuery.js';

const MIN_PROCESSING_TIME = 400; // purely for visual effect

export function Command({
  command,
  state,
  isActive = true,
  service,
  children,
  handlers,
  onAborted,
}: CommandProps) {
  const [error, setError] = useState<string | null>(state?.error ?? null);

  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        handlers?.onAborted?.('request');
        onAborted?.('request');
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

          // Check if tasks contain DEFINE type (variant selection needed)
          const hasDefineTask = result.tasks.some(
            (task) => task.type === TaskType.Define
          );

          // Create Plan definition
          const planDefinition = createPlanDefinition(
            result.message,
            result.tasks,
            hasDefineTask
              ? async (selectedTasks: Task[]) => {
                  // Refinement flow for DEFINE tasks
                  const refinementDef = createRefinement(
                    getRefiningMessage(),
                    (operation: string) => {
                      handlers?.onAborted?.(operation);
                    }
                  );

                  // Add refinement to queue
                  handlers?.addToQueue?.(refinementDef);

                  try {
                    // Call LLM to refine plan with selected tasks
                    const refinedCommand = selectedTasks
                      .map((task) => {
                        const action = task.action
                          .toLowerCase()
                          .replace(/,/g, ' -');
                        const type = task.type;
                        return `${action} (type: ${type})`;
                      })
                      .join(', ');

                    const refinedResult = await svc!.processWithTool(
                      refinedCommand,
                      'plan'
                    );

                    // Complete the Refinement component
                    handlers?.completeActive?.();

                    // Create NEW Plan with refined tasks (no onSelectionConfirmed)
                    const refinedPlanDefinition = createPlanDefinition(
                      refinedResult.message,
                      refinedResult.tasks,
                      undefined
                    );

                    // Create Confirm for execution
                    // Determine operation name based on refined task types
                    const allIntrospect = refinedResult.tasks.every(
                      (task) => task.type === TaskType.Introspect
                    );
                    const allAnswer = refinedResult.tasks.every(
                      (task) => task.type === TaskType.Answer
                    );

                    let operation = 'execution';
                    if (allIntrospect) {
                      operation = 'introspection';
                    } else if (allAnswer) {
                      operation = 'answer';
                    }

                    const confirmDefinition = createConfirmDefinition(
                      () => {
                        // Complete Confirm and create appropriate component based on task type
                        handlers?.completeActive?.();

                        if (allAnswer && refinedResult.tasks.length > 0) {
                          const question = refinedResult.tasks[0].action;
                          handlers?.addToQueue?.(
                            createAnswerDefinition(question, svc!)
                          );
                        } else if (
                          allIntrospect &&
                          refinedResult.tasks.length > 0
                        ) {
                          handlers?.addToQueue?.(
                            createIntrospectDefinition(
                              refinedResult.tasks,
                              svc!
                            )
                          );
                        } else if (refinedResult.tasks.length > 0) {
                          // Execute tasks
                          handlers?.addToQueue?.(
                            createExecuteDefinition(refinedResult.tasks, svc!)
                          );
                        }
                      },
                      () => {
                        handlers?.onAborted?.(operation);
                      }
                    );

                    // Add refined Plan to timeline and Confirm to queue
                    handlers?.addToTimeline?.(refinedPlanDefinition);
                    handlers?.addToQueue?.(confirmDefinition);
                  } catch (err) {
                    handlers?.completeActive?.();
                    const errorMessage = formatErrorMessage(err);
                    handlers?.onError?.(errorMessage);
                  }
                }
              : undefined
          );

          if (hasDefineTask) {
            // Has DEFINE tasks: Add Plan to queue for selection
            handlers?.addToQueue?.(planDefinition);
          } else {
            // No DEFINE tasks: Add Plan to timeline and Confirm to queue
            // Determine operation name based on task types
            const allIntrospect = result.tasks.every(
              (task) => task.type === TaskType.Introspect
            );
            const allAnswer = result.tasks.every(
              (task) => task.type === TaskType.Answer
            );

            let operation = 'execution';
            if (allIntrospect) {
              operation = 'introspection';
            } else if (allAnswer) {
              operation = 'answer';
            }

            const confirmDefinition = createConfirmDefinition(
              () => {
                // Complete Confirm and create appropriate component based on task type
                handlers?.completeActive?.();

                if (allAnswer && result.tasks.length > 0) {
                  const question = result.tasks[0].action;
                  handlers?.addToQueue?.(
                    createAnswerDefinition(question, svc!)
                  );
                } else if (allIntrospect && result.tasks.length > 0) {
                  handlers?.addToQueue?.(
                    createIntrospectDefinition(result.tasks, svc!)
                  );
                } else if (result.tasks.length > 0) {
                  // Execute tasks
                  handlers?.addToQueue?.(
                    createExecuteDefinition(result.tasks, svc!)
                  );
                }
              },
              () => {
                handlers?.onAborted?.(operation);
              }
            );
            handlers?.addToTimeline?.(planDefinition);
            handlers?.addToQueue?.(confirmDefinition);
          }

          // Move Command to timeline
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
  }, [command, isActive, service, handlers]);

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
