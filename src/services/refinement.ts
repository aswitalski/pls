import { Handlers } from '../types/components.js';
import { Task } from '../types/types.js';

import { LLMService } from './anthropic.js';
import { createRefinement } from './components.js';
import { formatErrorMessage, getRefiningMessage } from './messages.js';
import { routeTasksWithConfirm } from './task-router.js';

/**
 * Handle refinement flow for DEFINE tasks
 * Called when user selects options from a plan with DEFINE tasks
 */
export async function handleRefinement(
  selectedTasks: Task[],
  service: LLMService,
  originalCommand: string,
  handlers: Handlers
): Promise<void> {
  // Create and add refinement component to queue
  const refinementDef = createRefinement(
    getRefiningMessage(),
    (operation: string) => {
      handlers.onAborted(operation);
    }
  );

  handlers.addToQueue(refinementDef);

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
    const refinedResult = await service.processWithTool(refinedCommand, 'plan');

    // Complete the Refinement component
    handlers.completeActive();

    // Route refined tasks to appropriate components
    routeTasksWithConfirm(
      refinedResult.tasks,
      refinedResult.message,
      service,
      originalCommand,
      handlers,
      false, // No DEFINE tasks in refined result
      undefined // No commandComponent - use normal flow
    );
  } catch (err) {
    handlers.completeActive();
    const errorMessage = formatErrorMessage(err);
    handlers.onError(errorMessage);
  }
}
