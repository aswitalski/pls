import { describe, expect, it } from 'vitest';

import {
  Colors,
  getFeedbackColor,
  getTaskColors,
  getTextColor,
} from '../../src/services/colors.js';
import { FeedbackType, TaskType } from '../../src/types/types.js';

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

describe('getTaskColors', () => {
  it('returns colors for Introspect type', () => {
    const colors = getTaskColors(TaskType.Introspect, false);
    expect(colors).toBeDefined();
    expect(colors).toHaveProperty('description');
    expect(colors).toHaveProperty('type');
  });

  it('returns null description as inactive color for historical items', () => {
    const colors = getTaskColors(TaskType.Plan, false);
    expect(colors.description).toBe(Colors.Text.Inactive);
  });

  it('returns null description as active color for current items', () => {
    const colors = getTaskColors(TaskType.Plan, true);
    expect(colors.description).toBe(Colors.Text.Active);
  });

  it('returns correct type color for Introspect', () => {
    const colors = getTaskColors(TaskType.Introspect, false);
    expect(colors.type).toBe(Colors.Type.Introspect);
  });

  it('returns same type color for Introspect and Answer', () => {
    const introspectColors = getTaskColors(TaskType.Introspect, false);
    const answerColors = getTaskColors(TaskType.Answer, false);
    expect(introspectColors.type).toBe(answerColors.type);
  });

  it('works for all TaskType values', () => {
    const taskTypes = Object.values(TaskType);

    taskTypes.forEach((type) => {
      const colors = getTaskColors(type, false);
      expect(colors).toBeDefined();
      expect(colors).toHaveProperty('description');
      expect(colors).toHaveProperty('type');
    });
  });
});

describe('getFeedbackColor', () => {
  it('returns Info color', () => {
    const color = getFeedbackColor(FeedbackType.Info, false);
    expect(color).toBe(Colors.Status.Info);
  });

  it('returns Success color for Succeeded', () => {
    const color = getFeedbackColor(FeedbackType.Succeeded, false);
    expect(color).toBe(Colors.Status.Success);
  });

  it('returns Warning color for Aborted', () => {
    const color = getFeedbackColor(FeedbackType.Aborted, false);
    expect(color).toBe(Colors.Status.Warning);
  });

  it('returns Error color for Failed', () => {
    const color = getFeedbackColor(FeedbackType.Failed, false);
    expect(color).toBe(Colors.Status.Error);
  });

  it('works for all FeedbackType values', () => {
    const feedbackTypes = Object.values(FeedbackType);

    feedbackTypes.forEach((type) => {
      const color = getFeedbackColor(type, false);
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

  it('returns white for current items', () => {
    const color = getTextColor(true);
    expect(color).toBe('#ffffff');
  });

  it('returns ash gray for historical items', () => {
    const color = getTextColor(false);
    expect(color).toBe('#d0d0d0');
  });
});

describe('Real-world color scenarios', () => {
  describe('Active command execution', () => {
    it('shows command in white when executing', () => {
      const color = getTextColor(true);
      expect(color).toBe('#ffffff');
    });

    it('shows command in gray when completed', () => {
      const color = getTextColor(false);
      expect(color).toBe('#d0d0d0');
    });
  });

  describe('Answer component states', () => {
    it('always shows "Finding answer" in white (final response)', () => {
      // Answer component always uses active color since it's the final response
      expect(Colors.Text.Active).toBe('#ffffff');
    });
  });

  describe('Introspect component states', () => {
    it('shows "Listing capabilities" in white when processing', () => {
      const isCurrent = true;
      const color = getTextColor(isCurrent);
      expect(color).toBe(Colors.Text.Active);
    });

    it('shows "Listing capabilities" in gray when completed', () => {
      const isCurrent = false;
      const color = getTextColor(isCurrent);
      expect(color).toBe(Colors.Text.Inactive);
    });
  });

  describe('Confirm component states', () => {
    it('shows message in white when awaiting response', () => {
      const isCurrent = true;
      const color = getTextColor(isCurrent);
      expect(color).toBe(Colors.Text.Active);
    });

    it('shows message in gray after response', () => {
      const isCurrent = false;
      const color = getTextColor(isCurrent);
      expect(color).toBe(Colors.Text.Inactive);
    });

    it('shows user choice in gray in timeline', () => {
      const color = Colors.Text.Inactive;
      expect(color).toBe('#d0d0d0');
    });
  });

  describe('Task description colors based on state', () => {
    it('shows Execute task description in white when current', () => {
      const colors = getTaskColors(TaskType.Execute, true);
      expect(colors.description).toBe(Colors.Text.Active);
    });

    it('shows Execute task description in gray when historical', () => {
      const colors = getTaskColors(TaskType.Execute, false);
      expect(colors.description).toBe(Colors.Text.Inactive);
    });

    it('preserves task type colors regardless of state', () => {
      const currentColors = getTaskColors(TaskType.Execute, true);
      const historicalColors = getTaskColors(TaskType.Execute, false);
      expect(currentColors.type).toBe(historicalColors.type);
      expect(currentColors.type).toBe(Colors.Type.Execute);
    });
  });

  describe('Timeline rendering', () => {
    it('uses consistent inactive color for all historical items', () => {
      const commandColor = getTextColor(false);
      const answerColor = getTextColor(false);
      const introspectColor = getTextColor(false);

      expect(commandColor).toBe(answerColor);
      expect(answerColor).toBe(introspectColor);
      expect(commandColor).toBe(Colors.Text.Inactive);
    });

    it('uses consistent active color for all current items', () => {
      const commandColor = getTextColor(true);
      const answerColor = getTextColor(true);
      const introspectColor = getTextColor(true);

      expect(commandColor).toBe(answerColor);
      expect(answerColor).toBe(introspectColor);
      expect(commandColor).toBe(Colors.Text.Active);
    });
  });
});
