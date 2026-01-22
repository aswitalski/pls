import { useEffect, useState } from 'react';

import {
  CommandProps,
  CommandState,
  ComponentStatus,
} from '../../types/components.js';
import { Task, TaskType } from '../../types/types.js';

import { createSchedule } from '../../services/components.js';
import { useInput } from '../../services/keyboard.js';
import { formatErrorMessage } from '../../services/messages.js';
import { handleRefinement } from '../../services/refinement.js';
import { routeTasksWithConfirm } from '../../services/router.js';
import { ensureMinimumTime } from '../../services/timing.js';

import { CommandView } from '../views/Command.js';

export { CommandView, CommandViewProps } from '../views/Command.js';

const MIN_PROCESSING_TIME = 400; // purely for visual effect

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
        const result = await svc.processWithTool(command, 'schedule');

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Add debug components to timeline if present
          if (result.debug?.length) {
            workflowHandlers.addToTimeline(...result.debug);
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
