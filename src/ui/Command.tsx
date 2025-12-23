import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  CommandProps,
  ComponentDefinition,
  ComponentStatus,
  Handlers,
} from '../types/components.js';
import { Task, TaskType } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';
import { Colors } from '../services/colors.js';
import {
  addDebugToTimeline,
  createScheduleDefinition,
} from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { handleRefinement } from '../services/refinement.js';
import { routeTasksWithConfirm } from '../services/router.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';
import { UserQuery } from './UserQuery.js';

const MIN_PROCESSING_TIME = 400; // purely for visual effect

export function Command({
  command,
  state,
  status,
  service,
  handlers,
  onAborted,
}: CommandProps) {
  const isActive = status === ComponentStatus.Active;
  const [error, setError] = useState<string | null>(state?.error ?? null);

  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        handlers?.onAborted('request');
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
        let result = await svc!.processWithTool(command, 'schedule');

        // Save schedule debug output before potentially delegating
        const scheduleDebug = result.debug || [];

        // If all tasks are configure type, delegate to CONFIGURE tool
        const allConfig =
          result.tasks.length > 0 &&
          result.tasks.every((task) => task.type === TaskType.Config);

        if (allConfig) {
          // Extract query from first config task params, default to 'app'
          const query =
            (result.tasks[0].params?.query as string | undefined) || 'app';
          // Call CONFIGURE tool to get specific config keys
          result = await svc!.processWithTool(query, 'configure');
        }

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Add debug components to timeline if present
          // If we delegated to configure, include both schedule and configure debug
          // If not, only include schedule debug (result.debug is same as scheduleDebug)
          const debugComponents = allConfig
            ? [...scheduleDebug, ...(result.debug || [])]
            : scheduleDebug;
          addDebugToTimeline(debugComponents, handlers);

          // Save result to state for timeline display
          handlers?.updateState({
            message: result.message,
            tasks: result.tasks,
          });

          // Check if tasks contain DEFINE type (variant selection needed)
          const hasDefineTask = result.tasks.some(
            (task) => task.type === TaskType.Define
          );

          // Create Schedule definition
          const scheduleDefinition = createScheduleDefinition(
            result.message,
            result.tasks,
            hasDefineTask
              ? async (selectedTasks: Task[]) => {
                  // Refinement flow for DEFINE tasks
                  await handleRefinement(
                    selectedTasks,
                    svc!,
                    command,
                    handlers!
                  );
                }
              : undefined
          );

          if (hasDefineTask) {
            // DEFINE tasks: Move Command to timeline, add Schedule to queue
            handlers?.completeActive();
            handlers?.addToQueue(scheduleDefinition);
          } else {
            // No DEFINE tasks: Complete Command, then route to Confirm flow
            handlers?.completeActive();
            routeTasksWithConfirm(
              result.tasks,
              result.message,
              svc!,
              command,
              handlers!,
              false
            );
          }
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);
          handlers?.updateState({
            error: errorMessage,
          });
          handlers?.onError(errorMessage);
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
    </Box>
  );
}
