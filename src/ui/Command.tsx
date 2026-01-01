import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  CommandProps,
  CommandState,
  ComponentStatus,
} from '../types/components.js';
import { Task, TaskType } from '../types/types.js';

import { Colors } from '../services/colors.js';
import { createSchedule } from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { handleRefinement } from '../services/refinement.js';
import { routeTasksWithConfirm } from '../services/router.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';
import { UserQuery } from './UserQuery.js';

const MIN_PROCESSING_TIME = 400; // purely for visual effect

/**
 * Command view: Displays command with spinner
 */
export interface CommandViewProps {
  command: string;
  state: CommandState;
  status: ComponentStatus;
}

export const CommandView = ({ command, state, status }: CommandViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { error } = state;

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
};

/**
 * Command controller: Processes and routes command
 */

export function Command({
  command,
  status,
  service,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
  onAborted,
}: CommandProps) {
  const isActive = status === ComponentStatus.Active;

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        requestHandlers.onAborted('request');
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

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        let result = await svc.processWithTool(command, 'schedule');

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
          result = await svc.processWithTool(query, 'configure');
        }

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Add debug components to timeline if present
          // If we delegated to configure, include both schedule and configure debug
          // If not, only include schedule debug (result.debug is same as scheduleDebug)
          const debugComponents = allConfig
            ? [...scheduleDebug, ...(result.debug || [])]
            : scheduleDebug;
          if (debugComponents.length > 0) {
            workflowHandlers.addToTimeline(...debugComponents);
          }

          // Update local state
          setMessage(result.message);
          setTasks(result.tasks);

          // Expose final state
          const finalState: CommandState = {
            error: null,
            message: result.message,
            tasks: result.tasks,
          };
          requestHandlers.onCompleted(finalState);

          // Check if tasks contain DEFINE type (variant selection needed)
          const hasDefineTask = result.tasks.some(
            (task) => task.type === TaskType.Define
          );

          // Create Schedule definition
          const scheduleDefinition = createSchedule({
            message: result.message,
            tasks: result.tasks,
            onSelectionConfirmed: hasDefineTask
              ? async (selectedTasks: Task[]) => {
                  // Refinement flow for DEFINE tasks
                  await handleRefinement(
                    selectedTasks,
                    svc,
                    command,
                    lifecycleHandlers,
                    workflowHandlers,
                    requestHandlers
                  );
                }
              : undefined,
          });

          if (hasDefineTask) {
            // DEFINE tasks: Move Command to timeline, add Schedule to queue
            lifecycleHandlers.completeActive();
            workflowHandlers.addToQueue(scheduleDefinition);
          } else {
            // No DEFINE tasks: Complete Command, then route to Confirm flow
            lifecycleHandlers.completeActive();
            routeTasksWithConfirm(
              result.tasks,
              result.message,
              svc,
              command,
              lifecycleHandlers,
              workflowHandlers,
              requestHandlers,
              false
            );
          }
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);

          // Expose final state with error
          const finalState: CommandState = {
            error: errorMessage,
            message: null,
            tasks: [],
          };
          requestHandlers.onCompleted(finalState);

          requestHandlers.onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [
    command,
    isActive,
    service,
    requestHandlers,
    lifecycleHandlers,

    workflowHandlers,
  ]);

  const state: CommandState = { error, message, tasks };
  return <CommandView command={command} state={state} status={status} />;
}
