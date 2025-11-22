import { describe, expect, it } from 'vitest';

import { validateExecuteTasks } from '../src/services/execution-validator.js';
import { Task, TaskType } from '../src/types/types.js';

describe('Validating execute tasks', () => {
  it('handles tasks without skill params', () => {
    // Tasks created without skill params should not error
    const tasks: Task[] = [
      {
        action: 'Generic command',
        type: TaskType.Execute,
      },
    ];

    const missing = validateExecuteTasks(tasks);

    // Should return empty array for tasks without skills
    expect(missing).toEqual([]);
  });

  it('handles tasks with non-existent skill gracefully', () => {
    // Tasks referencing non-existent skills should not error
    const tasks: Task[] = [
      {
        action: 'Build something',
        type: TaskType.Execute,
        params: {
          skill: 'Non-Existent Skill',
          variant: 'alpha',
        },
      },
    ];

    expect(() => validateExecuteTasks(tasks)).not.toThrow();
  });

  it('deduplicates config checks across multiple tasks', () => {
    // Tasks with placeholder in action should be checked
    const tasks: Task[] = [
      {
        action: 'Navigate to {project.alpha.path}',
        type: TaskType.Execute,
      },
      {
        action: 'Build in {project.alpha.path}',
        type: TaskType.Execute,
      },
    ];

    const missing = validateExecuteTasks(tasks);

    // Should not have duplicates
    const paths = missing.map((req) => req.path);
    const uniquePaths = [...new Set(paths)];
    expect(paths.length).toBe(uniquePaths.length);
  });
});
