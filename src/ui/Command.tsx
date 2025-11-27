import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  CommandProps,
  ComponentDefinition,
  Handlers,
} from '../types/components.js';
import { Task, TaskType } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';

import { Colors } from '../services/colors.js';
import { routeTasksWithConfirm } from '../services/task-router.js';
import {
  createPlanDefinition,
  createRefinement,
} from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import {
  formatErrorMessage,
  getRefiningMessage,
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
          handlers?.updateState?.({
            message: result.message,
            tasks: result.tasks,
          });

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

                    // Route refined tasks to appropriate components
                    routeTasksWithConfirm(
                      refinedResult.tasks,
                      refinedResult.message,
                      svc!,
                      command,
                      handlers!,
                      false // No DEFINE tasks in refined result
                    );
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
            // The refinement callback will handle routing after user selects
            handlers?.addToQueue?.(planDefinition);
          } else {
            // No DEFINE tasks: Use routing service for Confirm flow
            routeTasksWithConfirm(
              result.tasks,
              result.message,
              svc!,
              command,
              handlers!,
              false
            );
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
