import {
  ErrorHandlers,
  LifecycleHandlers,
  QueueHandlers,
  WorkflowHandlers,
} from '../types/handlers.js';
import { Task } from '../types/types.js';

import { LLMService } from './anthropic.js';
import { createRefinement } from './components.js';
import { formatErrorMessage, getRefiningMessage } from './messages.js';
import { routeTasksWithConfirm } from './router.js';

/**
 * Handle refinement flow for DEFINE tasks
 * Called when user selects options from a plan with DEFINE tasks
 */
export async function handleRefinement(
  selectedTasks: Task[],
  service: LLMService,
  originalCommand: string,
  queueHandlers: QueueHandlers,
  lifecycleHandlers: LifecycleHandlers,
  workflowHandlers: WorkflowHandlers,
  errorHandlers: ErrorHandlers
): Promise<void> {
  // Create and add refinement component to queue
  const refinementDef = createRefinement(
    getRefiningMessage(),
    (operation: string) => {
      errorHandlers.onAborted(operation);
    }
  );

  queueHandlers.addToQueue(refinementDef);

  try {
    // Build refined command from selected tasks
    const refinedCommand = selectedTasks
      .map((task) => {
        const action = task.action.toLowerCase().replace(/,/g, ' -');
        const type = task.type;
        return `${action} (type: ${type})`;
      })
      .join(', ');

    // Call LLM to refine plan with selected tasks
    const refinedResult = await service.processWithTool(
      refinedCommand,
      'schedule'
    );

    // Complete the Refinement component
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
      queueHandlers,
      workflowHandlers,
      errorHandlers,
      false // No DEFINE tasks in refined result
    );
  } catch (err) {
    lifecycleHandlers.completeActive();
    const errorMessage = formatErrorMessage(err);
    errorHandlers.onError(errorMessage);
  }
}
