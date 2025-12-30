import { TaskInfo } from '../types/components.js';

import { ExecutionStatus } from '../services/shell.js';

/**
 * Calculate total elapsed time from task infos
 */
export function getTotalElapsed(tasks: TaskInfo[]): number {
  return tasks.reduce((sum, task) => sum + task.elapsed, 0);
}

/**
 * Calculate the number of finished tasks (success, failed, or aborted)
 */
export function getCompletedCount(tasks: TaskInfo[]): number {
  return tasks.filter(
    (task) =>
      task.status === ExecutionStatus.Success ||
      task.status === ExecutionStatus.Failed ||
      task.status === ExecutionStatus.Aborted
  ).length;
}

/**
 * Get the index of the current task to execute.
 * Returns the index of the first Running or Pending task, or tasks.length if all done.
 */
export function getCurrentTaskIndex(tasks: TaskInfo[]): number {
  const runningIndex = tasks.findIndex(
    (t) => t.status === ExecutionStatus.Running
  );
  if (runningIndex !== -1) return runningIndex;

  const pendingIndex = tasks.findIndex(
    (t) => t.status === ExecutionStatus.Pending
  );
  if (pendingIndex !== -1) return pendingIndex;

  return tasks.length;
}
