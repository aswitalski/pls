import { FeedbackType, TaskType } from '../types/types.js';

/**
 * Base color palette - raw color values with descriptive names.
 * All colors used in the interface are defined here.
 */
export const Palette = {
  White: '#ffffff',
  AshGray: '#d0d0d0',
  PaleGreen: '#a8dcbc',
  Gray: '#888888',
  DarkGray: '#666666',
  CharcoalGray: '#282828',
  Green: '#5aaa8a',
  LightGreen: '#65b595',
  BrightGreen: '#22aa22',
  Yellow: '#cccc5c',
  LightYellow: '#d4d47a',
  Orange: '#cc9c5c',
  DarkOrange: '#a85c3f',
  BurntOrange: '#cc7a5c',
  Red: '#cc5c5c',
  Cyan: '#5c9ccc',
  LightCyan: '#5ccccc',
  SteelBlue: '#5c8cbc',
  Purple: '#9c5ccc',
} as const;

/**
 * Semantic color palette - colors organized by their purpose/meaning.
 * References Palette colors to maintain consistency.
 */
export const Colors = {
  Text: {
    Active: Palette.White,
    Inactive: Palette.AshGray,
    UserQuery: Palette.White,
  },
  Background: {
    UserQuery: Palette.CharcoalGray,
  },
  Action: {
    Execute: Palette.Green,
    Discard: Palette.DarkOrange,
    Select: Palette.SteelBlue,
  },
  Status: {
    Success: Palette.BrightGreen,
    Error: Palette.Red,
    Warning: Palette.Orange,
    Info: Palette.Cyan,
  },
  Label: {
    Default: null, // calculated in runtime
    Inactive: Palette.Gray,
    Discarded: Palette.DarkGray,
    Skipped: Palette.Yellow,
  },
  Type: {
    Config: Palette.Cyan,
    Plan: Palette.LightCyan,
    Execute: Palette.Green,
    Answer: Palette.Purple,
    Introspect: Palette.Purple,
    Report: Palette.Orange,
    Define: Palette.Orange,
    Ignore: Palette.BurntOrange,
    Select: Palette.SteelBlue,
    Discard: Palette.DarkOrange,
  },
  Origin: {
    BuiltIn: Palette.Cyan,
    UserProvided: Palette.Green,
  },
} as const;

/**
 * Task-specific color mappings (internal)
 */
const TaskColors: Record<
  TaskType,
  { description: string | null; type: string | null }
> = {
  [TaskType.Config]: {
    description: Colors.Label.Default,
    type: Colors.Type.Config,
  },
  [TaskType.Plan]: {
    description: Colors.Label.Default,
    type: Colors.Type.Plan,
  },
  [TaskType.Execute]: {
    description: Colors.Label.Default,
    type: Colors.Type.Execute,
  },
  [TaskType.Answer]: {
    description: Colors.Label.Default,
    type: Colors.Type.Answer,
  },
  [TaskType.Introspect]: {
    description: Colors.Label.Default,
    type: Colors.Type.Introspect,
  },
  [TaskType.Report]: {
    description: Colors.Label.Default,
    type: Colors.Type.Report,
  },
  [TaskType.Define]: {
    description: Colors.Label.Default,
    type: Colors.Type.Define,
  },
  [TaskType.Ignore]: {
    description: Colors.Label.Skipped,
    type: Colors.Type.Ignore,
  },
  [TaskType.Select]: {
    description: Colors.Label.Inactive,
    type: Colors.Type.Select,
  },
  [TaskType.Discard]: {
    description: Colors.Label.Discarded,
    type: Colors.Type.Discard,
  },
} as const;

/**
 * Feedback-specific color mappings (internal)
 */
const FeedbackColors: Record<FeedbackType, string | null> = {
  [FeedbackType.Info]: Colors.Status.Info,
  [FeedbackType.Succeeded]: Colors.Status.Success,
  [FeedbackType.Aborted]: Colors.Status.Warning,
  [FeedbackType.Failed]: Colors.Status.Error,
} as const;

/**
 * Process null color values based on current/historical state.
 *
 * Replaces null with:
 * - Colors.Text.Active for current items
 * - Colors.Text.Inactive (undefined) for historical items
 */
function processColor(
  color: string | null,
  isCurrent: boolean
): string | undefined {
  return color === null
    ? isCurrent
      ? Colors.Text.Active
      : Colors.Text.Inactive
    : color;
}

/**
 * Get task colors with current/historical state handling.
 *
 * Processes null color values (terminal default) and replaces them with:
 * - Colors.Text.Inactive (undefined) for historical items
 * - Colors.Text.Active for current items
 */
export function getTaskColors(
  type: TaskType,
  isCurrent: boolean
): { description: string | undefined; type: string | undefined } {
  const colors = TaskColors[type];

  return {
    description: processColor(colors.description, isCurrent),
    type: processColor(colors.type, isCurrent),
  };
}

/**
 * Get feedback color with current/historical state handling.
 *
 * Processes null color values (terminal default) and replaces them with:
 * - Colors.Text.Inactive (undefined) for historical items
 * - Colors.Text.Active for current items
 */
export function getFeedbackColor(
  type: FeedbackType,
  isCurrent: boolean
): string | undefined {
  return processColor(FeedbackColors[type], isCurrent);
}

/**
 * Get text color based on current/historical state.
 *
 * Returns:
 * - Colors.Text.Active for current items
 * - Colors.Text.Inactive for historical items
 */
export function getTextColor(isCurrent: boolean): string {
  return isCurrent ? Colors.Text.Active : Colors.Text.Inactive;
}
