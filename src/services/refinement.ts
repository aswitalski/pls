import {
  BaseState,
  ComponentDefinition,
  ComponentStatus,
} from '../types/components.js';
import {
  LifecycleHandlers,
  RequestHandlers,
  WorkflowHandlers,
} from '../types/handlers.js';
import { Task } from '../types/types.js';

import { formatTaskAsYaml } from '../execution/processing.js';
import { LLMService } from './anthropic.js';
import { createCommand, createRefinement } from './components.js';
import { formatErrorMessage, getRefiningMessage } from './messages.js';
import { routeTasksWithConfirm } from './router.js';

/**
 * Handle refinement flow for DEFINE tasks
 * Called when user selects options from a plan with DEFINE tasks
 */
export async function handleRefinement<TState extends BaseState = BaseState>(
  selectedTasks: Task[],
  service: LLMService,
  originalCommand: string,
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>,
  workflowHandlers: WorkflowHandlers<ComponentDefinition>,
  requestHandlers: RequestHandlers<TState>
): Promise<void> {
  // Display the resolved command (from user's selection)
  // The first task's action contains the full resolved command
  const resolvedCommand = selectedTasks[0]?.action || originalCommand;
  const commandDisplay = createCommand(
    { command: resolvedCommand, service, onAborted: requestHandlers.onAborted },
    ComponentStatus.Done
  );
  workflowHandlers.addToTimeline(commandDisplay);

  // Create and add refinement component to queue
  const refinementDef = createRefinement({
    text: getRefiningMessage(),
    onAborted: (operation: string) => {
      requestHandlers.onAborted(operation);
    },
  });

  workflowHandlers.addToQueue(refinementDef);

  try {
    // Build refined command with action line followed by YAML metadata
    const refinedCommand = selectedTasks
      .map((task) => {
        // Replace commas with dashes for cleaner LLM prompt formatting
        const action = task.action.replace(/,/g, ' -');
        const metadata = { ...task.params, type: task.type };
        return formatTaskAsYaml(action, metadata);
      })
      .join('\n\n');

    // Call LLM to refine plan with selected tasks
    const refinedResult = await service.processWithTool(
      refinedCommand,
      'schedule'
    );

    // Complete the Refinement component with success state
    lifecycleHandlers.completeActive();

    // Add debug components to timeline if present
    if (refinedResult.debug?.length) {
      workflowHandlers.addToTimeline(...refinedResult.debug);
    }

    // Route refined tasks to appropriate components
    routeTasksWithConfirm(
      refinedResult.tasks,
      refinedResult.message,
      service,
      originalCommand,
      lifecycleHandlers,
      workflowHandlers,
      requestHandlers,
      false // No DEFINE tasks in refined result
    );
  } catch (err) {
    lifecycleHandlers.completeActive();
    const errorMessage = formatErrorMessage(err);
    requestHandlers.onError(errorMessage);
  }
}
