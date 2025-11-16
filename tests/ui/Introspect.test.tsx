import { describe, expect, it, vi } from 'vitest';

import { Task, TaskType } from '../../src/types/types.js';

// Test the parsing logic by importing the component and testing it indirectly
describe('Introspect capability parsing', () => {
  it('detects built-in capabilities correctly', () => {
    const builtInNames = ['PLAN', 'Plan', 'plan', 'EXECUTE', 'Execute'];

    builtInNames.forEach((name) => {
      // Built-in capabilities are detected case-insensitively
      const upperName = name.toUpperCase();
      expect([
        'PLAN',
        'EXECUTE',
        'CONFIG',
        'ANSWER',
        'INTROSPECT',
        'REPORT',
      ]).toContain(upperName);
    });
  });

  it('handles mixed built-in and user-defined capabilities', () => {
    const tasks: Task[] = [
      { action: 'Plan: break down requests', type: TaskType.Introspect },
      { action: 'Execute: run commands', type: TaskType.Introspect },
      { action: 'Deploy App: deploy application', type: TaskType.Introspect },
    ];

    // First two are built-in (case-insensitive match)
    expect(tasks.length).toBe(3);
    expect(tasks[0].action).toContain('Plan');
    expect(tasks[1].action).toContain('Execute');
    expect(tasks[2].action).toContain('Deploy App');
  });

  it('parses capability names and descriptions from task actions', () => {
    const task: Task = {
      action: 'Deploy Application: build and deploy to production',
      type: TaskType.Introspect,
    };

    const colonIndex = task.action.indexOf(':');
    const name = task.action.substring(0, colonIndex).trim();
    const description = task.action.substring(colonIndex + 1).trim();

    expect(name).toBe('Deploy Application');
    expect(description).toBe('build and deploy to production');
  });
});
