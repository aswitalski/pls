import { describe, expect, it } from 'vitest';

import {
  Colors,
  getFeedbackColor,
  getOriginColor,
  getStatusColors,
  getTaskColors,
  getTaskTypeLabel,
  getTextColor,
  Palette,
  STATUS_ICONS,
} from '../../src/services/colors.js';
import { DebugLevel } from '../../src/configuration/types.js';
import { ComponentStatus } from '../../src/types/components.js';
import { ExecutionStatus } from '../../src/services/shell.js';
import { FeedbackType, Origin, TaskType } from '../../src/types/types.js';

describe('Origin colors', () => {
  it('maps origin enum to correct colors', () => {
    expect(getOriginColor(Origin.BuiltIn)).toBe(Colors.Origin.BuiltIn);
    expect(getOriginColor(Origin.UserProvided)).toBe(
      Colors.Origin.UserProvided
    );
    expect(getOriginColor(Origin.Indirect)).toBe(Colors.Origin.Indirect);
  });
});

describe('getTaskColors', () => {
  it('returns colors for Introspect type', () => {
    const colors = getTaskColors(TaskType.Introspect, ComponentStatus.Done);
    expect(colors).toBeDefined();
    expect(colors).toHaveProperty('description');
    expect(colors).toHaveProperty('type');
  });

  it('returns null description as inactive color for historical items', () => {
    const colors = getTaskColors(TaskType.Schedule, ComponentStatus.Done);
    expect(colors.description).toBe(Colors.Text.Inactive);
  });

  it('returns null description as active color for current items', () => {
    const colors = getTaskColors(TaskType.Schedule, ComponentStatus.Active);
    expect(colors.description).toBe(Colors.Text.Active);
  });

  it('returns correct type color for Introspect', () => {
    const colors = getTaskColors(TaskType.Introspect, ComponentStatus.Done);
    expect(colors.type).toBe(Colors.Type.Introspect);
  });
});

describe('getFeedbackColor', () => {
  it('returns Info color', () => {
    const color = getFeedbackColor(FeedbackType.Info);
    expect(color).toBe(Colors.Status.Info);
  });

  it('returns Success color for Succeeded', () => {
    const color = getFeedbackColor(FeedbackType.Succeeded);
    expect(color).toBe(Colors.Status.Success);
  });

  it('returns BurntOrange color for Aborted', () => {
    const color = getFeedbackColor(FeedbackType.Aborted);
    expect(color).toBe(Palette.BurntOrange);
  });

  it('returns Error color for Failed', () => {
    const color = getFeedbackColor(FeedbackType.Failed);
    expect(color).toBe(Colors.Status.Error);
  });
});

describe('getTextColor', () => {
  it('returns active color for current items', () => {
    const color = getTextColor(true);
    expect(color).toBe(Colors.Text.Active);
  });

  it('returns inactive color for historical items', () => {
    const color = getTextColor(false);
    expect(color).toBe(Colors.Text.Inactive);
  });
});

describe('getTaskTypeLabel', () => {
  describe('Info mode (debug disabled or info)', () => {
    it('returns short label when debug is disabled', () => {
      expect(getTaskTypeLabel(TaskType.Config, DebugLevel.None)).toBe(
        'configure'
      );
      expect(getTaskTypeLabel(TaskType.Execute, DebugLevel.None)).toBe(
        'execute'
      );
    });

    it('returns short label in info mode', () => {
      expect(getTaskTypeLabel(TaskType.Schedule, DebugLevel.Info)).toBe(
        'schedule'
      );
      expect(getTaskTypeLabel(TaskType.Answer, DebugLevel.Info)).toBe('answer');
    });
  });

  describe('Verbose mode', () => {
    it('returns verbose label for config type', () => {
      expect(getTaskTypeLabel(TaskType.Config, DebugLevel.Verbose)).toBe(
        'configure option'
      );
    });

    it('returns verbose label for schedule type', () => {
      expect(getTaskTypeLabel(TaskType.Schedule, DebugLevel.Verbose)).toBe(
        'schedule tasks'
      );
    });

    it('returns verbose label for execute type', () => {
      expect(getTaskTypeLabel(TaskType.Execute, DebugLevel.Verbose)).toBe(
        'execute command'
      );
    });

    it('returns verbose label for answer type', () => {
      expect(getTaskTypeLabel(TaskType.Answer, DebugLevel.Verbose)).toBe(
        'answer question'
      );
    });

    it('returns verbose label for introspect type', () => {
      expect(getTaskTypeLabel(TaskType.Introspect, DebugLevel.Verbose)).toBe(
        'introspect capabilities'
      );
    });

    it('returns verbose label for report type', () => {
      expect(getTaskTypeLabel(TaskType.Report, DebugLevel.Verbose)).toBe(
        'report results'
      );
    });

    it('returns verbose label for define type', () => {
      expect(getTaskTypeLabel(TaskType.Define, DebugLevel.Verbose)).toBe(
        'define options'
      );
    });

    it('returns verbose label for ignore type', () => {
      expect(getTaskTypeLabel(TaskType.Ignore, DebugLevel.Verbose)).toBe(
        'ignore request'
      );
    });

    it('returns verbose label for select type', () => {
      expect(getTaskTypeLabel(TaskType.Select, DebugLevel.Verbose)).toBe(
        'select option'
      );
    });

    it('returns verbose label for discard type', () => {
      expect(getTaskTypeLabel(TaskType.Discard, DebugLevel.Verbose)).toBe(
        'discard option'
      );
    });
  });
});

describe('Execution status colors and icons', () => {
  describe('STATUS_ICONS', () => {
    it('has icons for all execution statuses', () => {
      const statuses = Object.values(ExecutionStatus);
      statuses.forEach((status) => {
        expect(STATUS_ICONS[status]).toBeDefined();
        expect(STATUS_ICONS[status]).toBeTruthy();
      });
    });
  });

  describe('getStatusColors', () => {
    it('returns color scheme for all execution statuses', () => {
      const statuses = Object.values(ExecutionStatus);
      statuses.forEach((status) => {
        const colors = getStatusColors(status);
        expect(colors).toBeDefined();
        expect(colors).toHaveProperty('icon');
        expect(colors).toHaveProperty('description');
        expect(colors).toHaveProperty('command');
        expect(colors).toHaveProperty('symbol');
      });
    });
  });
});
