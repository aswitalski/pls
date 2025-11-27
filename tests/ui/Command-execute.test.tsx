import { describe, expect, it, vi } from 'vitest';

import { TaskType } from '../../src/types/types.js';
import { createMockAnthropicService } from '../test-utils.js';

describe('Command component Execute routing', () => {
  it('routes Execute tasks correctly when all tasks are Execute type', async () => {
    const service = createMockAnthropicService({
      message: 'Here is my plan.',
      tasks: [
        { action: 'Build the project', type: TaskType.Execute },
        { action: 'Run tests', type: TaskType.Execute },
      ],
    });

    const result = await service.processWithTool('build and test', 'plan');

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].type).toBe(TaskType.Execute);
    expect(result.tasks[1].type).toBe(TaskType.Execute);
  });

  it('correctly identifies all Execute tasks', () => {
    const tasks = [
      { action: 'Build the project', type: TaskType.Execute },
      { action: 'Run tests', type: TaskType.Execute },
      { action: 'Deploy application', type: TaskType.Execute },
    ];

    const allExecute = tasks.every((task) => task.type === TaskType.Execute);
    expect(allExecute).toBe(true);
  });

  it('correctly identifies mixed task types', () => {
    const tasks = [
      { action: 'Build the project', type: TaskType.Execute },
      { action: 'Explain testing', type: TaskType.Answer },
    ];

    const allExecute = tasks.every((task) => task.type === TaskType.Execute);
    expect(allExecute).toBe(false);
  });
});
