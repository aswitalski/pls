import { ScheduledTask } from '../types/types.js';

/**
 * Calculates elapsed time from a start timestamp, rounded to seconds.
 */
export function calculateElapsed(start: number): number {
  return Math.floor((Date.now() - start) / 1000) * 1000;
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * Uses correct singular/plural forms.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${String(hours)} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${String(minutes)} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${String(seconds)} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ');
}

/**
 * Recursively extracts all leaf tasks from a hierarchical task structure.
 * Leaf tasks are tasks without subtasks.
 */
export function getAllLeafTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  const leafTasks: ScheduledTask[] = [];
  for (const task of tasks) {
    if (!task.subtasks || task.subtasks.length === 0) {
      leafTasks.push(task);
    } else {
      leafTasks.push(...getAllLeafTasks(task.subtasks));
    }
  }
  return leafTasks;
}
