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

describe('Color relationships', () => {
  it('uses same color for Introspect and Answer types', () => {
    expect(Colors.Type.Introspect).toBe(Colors.Type.Answer);
  });

  it('uses same color for Report and Define types', () => {
    expect(Colors.Type.Report).toBe(Colors.Type.Define);
  });

  it('uses different colors for active vs inactive text', () => {
    expect(Colors.Text.Active).not.toBe(Colors.Text.Inactive);
  });
});

describe('Origin colors for capability display', () => {
  it('uses distinct colors for system vs user', () => {
    // System and user origins must be visually distinguishable
    expect(Colors.Origin.BuiltIn).not.toBe(Colors.Origin.UserProvided);
  });

  it('uses same color for system capabilities as Config type', () => {
    // System capabilities share color with Config for visual consistency
    expect(Colors.Origin.BuiltIn).toBe(Colors.Type.Config);
  });

  it('uses same color for user capabilities as Execute action', () => {
    // User capabilities share color with Execute for consistency
    expect(Colors.Origin.UserProvided).toBe(Colors.Action.Execute);
  });

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

  it('returns same type color for Introspect and Answer', () => {
    const introspectColors = getTaskColors(
      TaskType.Introspect,
      ComponentStatus.Done
    );
    const answerColors = getTaskColors(TaskType.Answer, ComponentStatus.Done);
    expect(introspectColors.type).toBe(answerColors.type);
  });

  it('works for all TaskType values', () => {
    const taskTypes = Object.values(TaskType);

    taskTypes.forEach((type) => {
      const colors = getTaskColors(type, ComponentStatus.Done);
      expect(colors).toBeDefined();
      expect(colors).toHaveProperty('description');
      expect(colors).toHaveProperty('type');
    });
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

  it('returns MediumOrange color for Aborted', () => {
    const color = getFeedbackColor(FeedbackType.Aborted);
    expect(color).toBe(Palette.MediumOrange);
  });

  it('returns Error color for Failed', () => {
    const color = getFeedbackColor(FeedbackType.Failed);
    expect(color).toBe(Colors.Status.Error);
  });

  it('defaults to ComponentStatus.Done when status parameter is omitted', () => {
    const colorWithDefault = getFeedbackColor(FeedbackType.Info);
    const colorWithExplicitDone = getFeedbackColor(
      FeedbackType.Info,
      ComponentStatus.Done
    );
    expect(colorWithDefault).toBe(colorWithExplicitDone);
    expect(colorWithDefault).toBe(Colors.Status.Info);
  });

  it('works for all FeedbackType values', () => {
    const feedbackTypes = Object.values(FeedbackType);

    feedbackTypes.forEach((type) => {
      const color = getFeedbackColor(type);
      expect(color).toBeDefined();
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

describe('getTextColor', () => {
  it('returns active color for current items', () => {
    const color = getTextColor(true);
    expect(color).toBe(Colors.Text.Active);
  });

  it('returns inactive color for historical items', () => {
    const color = getTextColor(false);
    expect(color).toBe(Colors.Text.Inactive);
  });

  it('returns different colors for current vs historical items', () => {
    const currentColor = getTextColor(true);
    const historicalColor = getTextColor(false);
    expect(currentColor).not.toBe(historicalColor);
  });
});

describe('Real-world color scenarios', () => {
  describe('Task description colors based on state', () => {
    it('uses active text color for current task descriptions', () => {
      const colors = getTaskColors(TaskType.Execute, ComponentStatus.Active);
      expect(colors.description).toBe(Colors.Text.Active);
    });

    it('uses inactive text color for historical task descriptions', () => {
      const colors = getTaskColors(TaskType.Execute, ComponentStatus.Done);
      expect(colors.description).toBe(Colors.Text.Inactive);
    });

    it('preserves task type colors regardless of current/historical state', () => {
      const currentColors = getTaskColors(
        TaskType.Execute,
        ComponentStatus.Active
      );
      const historicalColors = getTaskColors(
        TaskType.Execute,
        ComponentStatus.Done
      );
      expect(currentColors.type).toBe(historicalColors.type);
      expect(currentColors.type).toBe(Colors.Type.Execute);
    });
  });

  describe('Timeline rendering consistency', () => {
    it('uses same inactive color for all historical items', () => {
      const commandColor = getTextColor(false);
      const answerColor = getTextColor(false);
      const introspectColor = getTextColor(false);

      expect(commandColor).toBe(answerColor);
      expect(answerColor).toBe(introspectColor);
      expect(commandColor).toBe(Colors.Text.Inactive);
    });

    it('uses same active color for all current items', () => {
      const commandColor = getTextColor(true);
      const answerColor = getTextColor(true);
      const introspectColor = getTextColor(true);

      expect(commandColor).toBe(answerColor);
      expect(answerColor).toBe(introspectColor);
      expect(commandColor).toBe(Colors.Text.Active);
    });
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

    it('returns short labels for all task types', () => {
      const taskTypes = Object.values(TaskType);

      taskTypes.forEach((type) => {
        const label = getTaskTypeLabel(type, DebugLevel.Info);
        expect(label).toBe(type);
      });
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

  describe('Label consistency', () => {
    it('verbose labels start with same or related keyword as short labels', () => {
      const taskTypes = Object.values(TaskType);

      taskTypes.forEach((type) => {
        const shortLabel = getTaskTypeLabel(type, DebugLevel.Info);
        const verboseLabel = getTaskTypeLabel(type, DebugLevel.Verbose);

        // Most labels start with the same keyword
        // Config is special: "config" -> "configure settings" (related verb form)
        if (type === TaskType.Config) {
          expect(verboseLabel.startsWith('configure')).toBe(true);
        } else {
          expect(verboseLabel.startsWith(shortLabel)).toBe(true);
        }
      });
    });

    it('verbose labels are longer than short labels', () => {
      const taskTypes = Object.values(TaskType);

      taskTypes.forEach((type) => {
        const shortLabel = getTaskTypeLabel(type, DebugLevel.Info);
        const verboseLabel = getTaskTypeLabel(type, DebugLevel.Verbose);

        expect(verboseLabel.length).toBeGreaterThan(shortLabel.length);
      });
    });

    it('verbose labels contain 2-3 words', () => {
      const taskTypes = Object.values(TaskType);

      taskTypes.forEach((type) => {
        const verboseLabel = getTaskTypeLabel(type, DebugLevel.Verbose);
        const wordCount = verboseLabel.split(' ').length;

        // Most labels have 2 words, config has 3 ("configure the setting")
        expect(wordCount).toBeGreaterThanOrEqual(2);
        expect(wordCount).toBeLessThanOrEqual(3);
      });
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

  describe('Color palette additions', () => {
    it('uses MediumOrange for aborted feedback', () => {
      const color = getFeedbackColor(FeedbackType.Aborted);
      expect(color).toBe(Palette.MediumOrange);
    });
  });
});
