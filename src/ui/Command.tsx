import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  CommandProps,
  ComponentDefinition,
  ComponentStatus,
  Handlers,
} from '../types/components.js';
import { Task, TaskType } from '../types/types.js';

import {
  ComprehensionResult,
  ComprehensionStatus,
  LLMService,
} from '../services/anthropic.js';

import { Colors } from '../services/colors.js';
import { createPlanDefinition } from '../services/components.js';
import { formatErrorMessage } from '../services/messages.js';
import { useInput } from '../services/keyboard.js';
import { handleRefinement } from '../services/refinement.js';
import { routeTasksWithConfirm } from '../services/task-router.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';
import { UserQuery } from './UserQuery.js';

const MIN_PROCESSING_TIME = 400; // purely for visual effect

/**
 * Validate comprehension result structure
 * Ensures the LLM returned well-formed data before using it
 */
function validateComprehensionResult(
  comprehension: ComprehensionResult | undefined
): string | null {
  if (!comprehension) {
    return 'Missing comprehension result';
  }

  if (!Array.isArray(comprehension.items)) {
    return 'Comprehension items must be an array';
  }

  for (let i = 0; i < comprehension.items.length; i++) {
    const item = comprehension.items[i];

    if (!item.verb || typeof item.verb !== 'string') {
      return `Item ${i}: missing or invalid verb field`;
    }

    if (!item.status || typeof item.status !== 'string') {
      return `Item ${i}: missing or invalid status field`;
    }

    // Validate status is a known enum value
    const validStatuses = Object.values(ComprehensionStatus);
    if (!validStatuses.includes(item.status as ComprehensionStatus)) {
      return `Item ${i}: invalid status value "${item.status}"`;
    }

    // If status is core or custom, name field is required
    if (
      (item.status === ComprehensionStatus.Core ||
        item.status === ComprehensionStatus.Custom) &&
      (!item.name || typeof item.name !== 'string')
    ) {
      return `Item ${i}: name field required for ${item.status} status`;
    }
  }

  return null;
}

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

    /**
     * Two-step command processing workflow:
     *
     * 1. COMPREHEND: Quickly analyze the request and match verbs to capabilities
     *    - Separates verb matching from execution planning
     *    - Provides fast feedback to the user
     *    - Detects harmful requests early
     *
     * 2. PLAN: Create detailed execution tasks based on comprehension results
     *    - Uses comprehension results to create concrete steps
     *    - Handles skill expansion and parameter resolution
     *    - Generates final task list for execution
     */
    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        // Step 1: Call COMPREHEND tool to analyze request and match verbs
        let comprehendResult;
        try {
          comprehendResult = await svc!.processWithTool(command, 'comprehend');
        } catch (err) {
          throw new Error(
            `Failed to analyze request: ${formatErrorMessage(err)}`
          );
        }

        // Validate comprehension result structure
        const validationError = validateComprehensionResult(
          comprehendResult.comprehension
        );
        if (validationError) {
          throw new Error(`Invalid comprehension result: ${validationError}`);
        }

        if (mounted && comprehendResult.comprehension) {
          // Check for harmful/offensive request (empty message)
          if (comprehendResult.comprehension.message === '') {
            setError('Request aborted: harmful or offensive content detected');
            handlers?.onError(
              'Request aborted: harmful or offensive content detected'
            );
            return;
          }

          // Show temporary comprehend message to user
          handlers?.updateState({
            message: comprehendResult.comprehension.message,
            tasks: [],
          });
        }

        // Step 2: Call PLAN tool with validated comprehension results
        let result;
        try {
          result = await svc!.processWithTool(
            command,
            'plan',
            comprehendResult.comprehension
          );
        } catch (err) {
          throw new Error(`Failed to create plan: ${formatErrorMessage(err)}`);
        }

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
          // Replace comprehend message with plan message
          handlers?.updateState({
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
            // DEFINE tasks: Move Command to timeline, add Plan to queue
            handlers?.completeActive();
            handlers?.addToQueue(planDefinition);
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
