import { TaskInfo } from '../types/components.js';

/**
 * Calculate total elapsed time from task infos
 */
export function getTotalElapsed(tasks: TaskInfo[]): number {
  return tasks.reduce((sum, task) => sum + task.elapsed, 0);
}
