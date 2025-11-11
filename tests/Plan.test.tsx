import { describe, it, expect } from 'vitest';
import React from 'react';

import { Plan } from '../src/ui/Plan.js';
import { TaskType } from '../src/types/components.js';

describe('Plan component', () => {
  describe('Rendering tasks', () => {
    it('renders single task', () => {
      const result = (
        <Plan
          tasks={[{ action: 'Install dependencies', type: TaskType.Execute }]}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.tasks).toHaveLength(1);
      expect(result.props.tasks[0].action).toBe('Install dependencies');
    });

    it('renders multiple tasks', () => {
      const result = (
        <Plan
          tasks={[
            { action: 'Install dependencies', type: TaskType.Execute },
            { action: 'Run tests', type: TaskType.Execute },
            { action: 'Build project', type: TaskType.Execute },
          ]}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.tasks).toHaveLength(3);
    });

    it('renders task with message', () => {
      const result = (
        <Plan
          message="Here is the plan"
          tasks={[{ action: 'Install dependencies', type: TaskType.Execute }]}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.message).toBe('Here is the plan');
    });
  });

  describe('Task types', () => {
    it('renders execute task', () => {
      const result = (
        <Plan tasks={[{ action: 'Run command', type: TaskType.Execute }]} />
      );

      expect(result.props.tasks[0].type).toBe(TaskType.Execute);
    });

    it('renders define task with options', () => {
      const result = (
        <Plan
          tasks={[
            {
              action: 'Choose deployment target',
              type: TaskType.Define,
              params: {
                options: ['Production', 'Staging', 'Development'],
              },
            },
          ]}
        />
      );

      expect(result.props.tasks[0].type).toBe(TaskType.Define);
      expect(result.props.tasks[0].params?.options).toEqual([
        'Production',
        'Staging',
        'Development',
      ]);
    });

    it('renders answer task', () => {
      const result = (
        <Plan
          tasks={[{ action: 'Provide information', type: TaskType.Answer }]}
        />
      );

      expect(result.props.tasks[0].type).toBe(TaskType.Answer);
    });

    it('renders ignore task', () => {
      const result = (
        <Plan
          tasks={[{ action: 'Skip unknown request', type: TaskType.Ignore }]}
        />
      );

      expect(result.props.tasks[0].type).toBe(TaskType.Ignore);
    });
  });

  describe('Mixed tasks', () => {
    it('renders mix of execute and define tasks', () => {
      const result = (
        <Plan
          tasks={[
            { action: 'Build project', type: TaskType.Execute },
            {
              action: 'Choose deployment target',
              type: TaskType.Define,
              params: { options: ['Production', 'Staging'] },
            },
            { action: 'Deploy application', type: TaskType.Execute },
          ]}
        />
      );

      expect(result.props.tasks).toHaveLength(3);
      expect(result.props.tasks[0].type).toBe(TaskType.Execute);
      expect(result.props.tasks[1].type).toBe(TaskType.Define);
      expect(result.props.tasks[2].type).toBe(TaskType.Execute);
    });
  });

  describe('Empty and edge cases', () => {
    it('renders empty task list', () => {
      const result = <Plan tasks={[]} />;

      expect(result).toBeDefined();
      expect(result.props.tasks).toHaveLength(0);
    });

    it('renders without message', () => {
      const result = (
        <Plan tasks={[{ action: 'Do something', type: TaskType.Execute }]} />
      );

      expect(result).toBeDefined();
      expect(result.props.message).toBeUndefined();
    });

    it('renders task with complex params', () => {
      const result = (
        <Plan
          tasks={[
            {
              action: 'Execute complex operation',
              type: TaskType.Execute,
              params: {
                command: 'npm run build',
                env: { NODE_ENV: 'production' },
                cwd: '/path/to/project',
              },
            },
          ]}
        />
      );

      expect(result.props.tasks[0].params).toEqual({
        command: 'npm run build',
        env: { NODE_ENV: 'production' },
        cwd: '/path/to/project',
      });
    });
  });
});
