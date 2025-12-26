import { describe, expect, it } from 'vitest';

import {
  CommandResultSchema,
  ExecuteCommandSchema,
  ScheduledTaskSchema,
} from '../../src/types/schemas.js';

describe('ExecuteCommandSchema', () => {
  it('validates timeout is a positive integer', () => {
    // Valid: positive integer
    expect(
      ExecuteCommandSchema.safeParse({
        description: 'Test',
        command: 'npm test',
        timeout: 5000,
      }).success
    ).toBe(true);

    // Invalid: negative timeout
    expect(
      ExecuteCommandSchema.safeParse({
        description: 'Test',
        command: 'npm test',
        timeout: -1,
      }).success
    ).toBe(false);

    // Invalid: zero timeout
    expect(
      ExecuteCommandSchema.safeParse({
        description: 'Test',
        command: 'npm test',
        timeout: 0,
      }).success
    ).toBe(false);

    // Invalid: non-integer timeout
    expect(
      ExecuteCommandSchema.safeParse({
        description: 'Test',
        command: 'npm test',
        timeout: 30.5,
      }).success
    ).toBe(false);
  });
});

describe('ScheduledTaskSchema', () => {
  it('validates deeply nested subtasks recursively', () => {
    const deeplyNestedTask = {
      action: 'Root task',
      type: 'group',
      subtasks: [
        {
          action: 'Level 1 task',
          type: 'group',
          subtasks: [
            {
              action: 'Level 2 task',
              type: 'execute',
            },
            {
              action: 'Invalid level 2 task',
              type: 'execute',
              // Missing required action field in nested subtask
              subtasks: [
                {
                  type: 'execute', // Missing action - should fail
                },
              ],
            },
          ],
        },
      ],
    };

    // Should fail because deeply nested subtask is missing action
    const result = ScheduledTaskSchema.safeParse(deeplyNestedTask);
    expect(result.success).toBe(false);

    // Valid nested structure should pass
    const validNestedTask = {
      action: 'Root task',
      type: 'group',
      subtasks: [
        {
          action: 'Level 1',
          type: 'group',
          subtasks: [
            {
              action: 'Level 2',
              type: 'execute',
            },
          ],
        },
      ],
    };

    expect(ScheduledTaskSchema.safeParse(validNestedTask).success).toBe(true);
  });
});

describe('CommandResultSchema', () => {
  it('preserves subtasks in Group tasks', () => {
    // Regression test: ensure Group tasks with subtasks are preserved
    const scheduleResponse = {
      message: 'Building project',
      tasks: [
        {
          action: 'Build project',
          type: 'group',
          subtasks: [
            {
              action: 'Compile TypeScript',
              type: 'execute',
            },
            {
              action: 'Run tests',
              type: 'execute',
            },
          ],
        },
      ],
    };

    const result = CommandResultSchema.safeParse(scheduleResponse);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tasks[0].subtasks).toBeDefined();
      expect(result.data.tasks[0].subtasks).toHaveLength(2);
      expect(result.data.tasks[0].subtasks?.[0].action).toBe(
        'Compile TypeScript'
      );
    }
  });
});
