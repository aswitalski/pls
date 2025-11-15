import { describe, expect, it } from 'vitest';

import { Colors, FeedbackColors, TaskColors } from '../../src/types/colors.js';
import { TaskType } from '../../src/types/types.js';

describe('TaskType enum', () => {
  it('includes Introspect type', () => {
    expect(TaskType.Introspect).toBe('introspect');
  });

  it('has all expected task types', () => {
    const expectedTypes = [
      'config',
      'plan',
      'execute',
      'answer',
      'introspect',
      'report',
      'define',
      'ignore',
      'select',
      'discard',
    ];

    const actualTypes = Object.values(TaskType);
    expect(actualTypes).toEqual(expectedTypes);
  });
});

describe('Colors.Type', () => {
  it('defines Introspect color', () => {
    expect(Colors.Type.Introspect).toBeDefined();
    expect(typeof Colors.Type.Introspect).toBe('string');
  });

  it('uses purple color for Introspect', () => {
    expect(Colors.Type.Introspect).toBe('#9c5ccc');
  });

  it('matches Answer color for Introspect', () => {
    expect(Colors.Type.Introspect).toBe(Colors.Type.Answer);
  });
});

describe('TaskColors mapping', () => {
  it('includes mapping for Introspect type', () => {
    expect(TaskColors[TaskType.Introspect]).toBeDefined();
  });

  it('maps Introspect to correct colors', () => {
    expect(TaskColors[TaskType.Introspect]).toEqual({
      description: Colors.Label.Default,
      type: Colors.Type.Introspect,
    });
  });

  it('has mapping for every TaskType', () => {
    const taskTypes = Object.values(TaskType);
    const mappedTypes = Object.keys(TaskColors);

    expect(mappedTypes.length).toBe(taskTypes.length);

    taskTypes.forEach((type) => {
      expect(TaskColors[type]).toBeDefined();
    });
  });

  it('uses same type color for Introspect and Answer', () => {
    expect(TaskColors[TaskType.Introspect].type).toBe(
      TaskColors[TaskType.Answer].type
    );
  });
});

describe('Color consistency', () => {
  it('ensures all TaskColors use valid Colors values', () => {
    const validColors = new Set<string>([
      ...Object.values(Colors.Action),
      ...Object.values(Colors.Status),
      ...Object.values(Colors.Label),
      ...Object.values(Colors.Type),
    ]);

    Object.values(TaskColors).forEach((colors) => {
      expect(validColors.has(colors.description)).toBe(true);
      expect(validColors.has(colors.type)).toBe(true);
    });
  });

  it('ensures all FeedbackColors use valid Status colors', () => {
    const validStatusColors = new Set<string>(Object.values(Colors.Status));

    Object.values(FeedbackColors).forEach((color) => {
      expect(validStatusColors.has(color)).toBe(true);
    });
  });
});

describe('Type colors match action colors where appropriate', () => {
  it('uses same green for Execute type and action', () => {
    expect(Colors.Type.Execute).toBe(Colors.Action.Execute);
  });

  it('uses same steel blue for Select type and action', () => {
    expect(Colors.Type.Select).toBe(Colors.Action.Select);
  });

  it('uses same dark orange for Discard type and action', () => {
    expect(Colors.Type.Discard).toBe(Colors.Action.Discard);
  });
});
