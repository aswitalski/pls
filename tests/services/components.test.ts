import { describe, expect, it, vi } from 'vitest';

import {
  createRefinement,
  createSchedule,
} from '../../src/services/components.js';
import { ComponentName, TaskType } from '../../src/types/types.js';

describe('Refinement component definition', () => {
  it('creates valid stateful refinement definition', () => {
    const onAborted = vi.fn();
    const def = createRefinement({ text: 'Processing request', onAborted });

    expect(def.name).toBe(ComponentName.Refinement);
    if (def.name === ComponentName.Refinement) {
      expect(def.props.text).toBe('Processing request');
      expect(def.props.onAborted).toBe(onAborted);
    }
  });
});

describe('Schedule component definition', () => {
  it('creates definition without callback for DEFINE tasks', () => {
    const tasks = [
      {
        action: 'Choose option',
        type: TaskType.Define,
        params: { options: ['A', 'B'] },
        config: [],
      },
    ];

    const def = createSchedule({ message: 'Select an option.', tasks });

    expect(def.name).toBe(ComponentName.Schedule);
    if (def.name === ComponentName.Schedule) {
      expect(def.props.message).toBe('Select an option.');
      expect(def.props.tasks).toEqual(tasks);
      expect(def.props.onSelectionConfirmed).toBeUndefined();
      expect(def.state).toBeDefined();
      expect(def.state.highlightedIndex).toBeNull();
      expect(def.state.currentDefineGroupIndex).toBe(0);
      expect(def.state.completedSelections).toEqual([]);
    }
  });

  it('creates definition with callback for auto-complete', () => {
    const tasks = [
      { action: 'Build project', type: TaskType.Execute, config: [] },
    ];
    const callback = vi.fn();

    const def = createSchedule({
      message: 'Building.',
      tasks,
      onSelectionConfirmed: callback,
    });

    expect(def.name).toBe(ComponentName.Schedule);
    if (def.name === ComponentName.Schedule) {
      expect(def.props.message).toBe('Building.');
      expect(def.props.tasks).toEqual(tasks);
      expect(def.props.onSelectionConfirmed).toBe(callback);
      expect(def.state).toBeDefined();
    }
  });
});
