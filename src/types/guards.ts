import { Task, ScheduledTask, TaskType } from './types.js';
import { TaskSchema } from './schemas.js';

/**
 * Type guard to check if a task is a ScheduledTask
 * ScheduledTask has optional subtasks property or is a Group type
 */
export function isScheduledTask(task: Task): task is ScheduledTask {
  return 'subtasks' in task || task.type === TaskType.Group;
}

/**
 * Type-safe conversion of Task array to ScheduledTask array
 * This is safe because Tasks can be treated as ScheduledTask when checking for Groups
 */
export function asScheduledTasks(tasks: Task[]): ScheduledTask[] {
  return tasks as ScheduledTask[];
}

/**
 * Type guard to check if a value is a valid Task.
 * Uses Zod schema for comprehensive runtime validation.
 */
export function isTask(value: unknown): value is Task {
  return TaskSchema.safeParse(value).success;
}
