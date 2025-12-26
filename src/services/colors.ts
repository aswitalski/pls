import { FeedbackType, Origin, TaskType } from '../types/types.js';
import { DebugLevel } from './configuration.js';
import { ExecutionStatus } from './shell.js';

/**
 * Base color palette - raw color values with descriptive names.
 * All colors used in the interface are defined here.
 */
export const Palette = {
  White: '#ffffff',
  AshGray: '#d0d0d0',
  Gray: '#888888',
  DarkGray: '#666666',
  CharcoalGray: '#282828',
  Green: '#5aaa8a',
  LightGreen: '#65b595',
  BrightGreen: '#3e9a3e',
  Yellow: '#cccc5c',
  Orange: '#f48c80',
  MediumOrange: '#d07560',
  DarkOrange: '#ab5e40',
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
    Warning: Palette.MediumOrange,
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
    Schedule: Palette.LightCyan,
    Execute: Palette.Green,
    Answer: Palette.Purple,
    Introspect: Palette.Purple,
    Report: Palette.Orange,
    Define: Palette.Orange,
    Ignore: Palette.BurntOrange,
    Select: Palette.SteelBlue,
    Discard: Palette.DarkOrange,
    Group: Palette.Yellow,
  },
  Origin: {
    BuiltIn: Palette.Cyan,
    UserProvided: Palette.Green,
    Indirect: Palette.Purple,
  },
} as const;

/**
 * Task-specific color mappings (internal)
 */
const taskColors: Record<
  TaskType,
  { description: string | null; type: string | null }
> = {
  [TaskType.Config]: {
    description: Colors.Label.Default,
    type: Colors.Type.Config,
  },
  [TaskType.Schedule]: {
    description: Colors.Label.Default,
    type: Colors.Type.Schedule,
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
  [TaskType.Group]: {
    description: Colors.Label.Default,
    type: Colors.Type.Group,
  },
} as const;

/**
 * Feedback-specific color mappings (internal)
 */
const feedbackColors: Record<FeedbackType, string | null> = {
  [FeedbackType.Info]: Colors.Status.Info,
  [FeedbackType.Warning]: Palette.Yellow,
  [FeedbackType.Succeeded]: Colors.Status.Success,
  [FeedbackType.Aborted]: Palette.MediumOrange,
  [FeedbackType.Failed]: Colors.Status.Error,
} as const;

/**
 * Origin-specific color mappings (internal)
 */
const originColors: Record<Origin, string> = {
  [Origin.BuiltIn]: Colors.Origin.BuiltIn,
  [Origin.UserProvided]: Colors.Origin.UserProvided,
  [Origin.Indirect]: Colors.Origin.Indirect,
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
  const colors = taskColors[type];

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
  return processColor(feedbackColors[type], isCurrent);
}

/**
 * Get color for capability origin.
 *
 * Returns the color associated with each origin type:
 * - BuiltIn: Cyan
 * - UserProvided: Green
 * - Indirect: Purple
 */
export function getOriginColor(origin: Origin): string {
  return originColors[origin];
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

/**
 * Verbose task type labels - two-word descriptions that start with the same
 * keyword as the short version
 */
const verboseTaskTypeLabels: Record<TaskType, string> = {
  [TaskType.Config]: 'configure option',
  [TaskType.Schedule]: 'schedule tasks',
  [TaskType.Execute]: 'execute command',
  [TaskType.Answer]: 'answer question',
  [TaskType.Introspect]: 'introspect capabilities',
  [TaskType.Report]: 'report results',
  [TaskType.Define]: 'define options',
  [TaskType.Ignore]: 'ignore request',
  [TaskType.Select]: 'select option',
  [TaskType.Discard]: 'discard option',
  [TaskType.Group]: 'group tasks',
} as const;

/**
 * Get task type label based on debug level.
 *
 * Returns:
 * - Verbose label (2 words) in verbose mode
 * - Short label (1 word) in info mode or when debug is off
 */
export function getTaskTypeLabel(type: TaskType, debug: DebugLevel): string {
  if (debug === DebugLevel.Verbose) {
    return verboseTaskTypeLabels[type];
  }
  return type;
}

/**
 * Status icons for execution states
 */
export const STATUS_ICONS: Record<ExecutionStatus, string> = {
  [ExecutionStatus.Pending]: '- ',
  [ExecutionStatus.Running]: '• ',
  [ExecutionStatus.Success]: '✓ ',
  [ExecutionStatus.Failed]: '✗ ',
  [ExecutionStatus.Aborted]: '⊘ ',
  [ExecutionStatus.Cancelled]: '⊘ ',
};

/**
 * Get colors for different execution status states.
 *
 * Returns color scheme for:
 * - Icon: Status indicator symbol
 * - Description: Task description text
 * - Command: Command text
 * - Symbol: Command prefix symbol
 */
export function getStatusColors(status: ExecutionStatus) {
  switch (status) {
    case ExecutionStatus.Pending:
      return {
        icon: Palette.Gray,
        description: Palette.Gray,
        command: Palette.DarkGray,
        symbol: Palette.DarkGray,
      };
    case ExecutionStatus.Running:
      return {
        icon: Palette.Gray,
        description: getTextColor(true),
        command: Palette.LightGreen,
        symbol: Palette.AshGray,
      };
    case ExecutionStatus.Success:
      return {
        icon: Colors.Status.Success,
        description: Palette.AshGray,
        command: Palette.Gray,
        symbol: Palette.Gray,
      };
    case ExecutionStatus.Failed:
      return {
        icon: Colors.Status.Error,
        description: Colors.Status.Error,
        command: Colors.Status.Error,
        symbol: Palette.Gray,
      };
    case ExecutionStatus.Aborted:
      return {
        icon: Palette.MediumOrange,
        description: Palette.Gray,
        command: Palette.MediumOrange,
        symbol: Palette.Gray,
      };
    case ExecutionStatus.Cancelled:
      return {
        icon: Palette.DarkGray,
        description: Palette.DarkGray,
        command: Palette.DarkGray,
        symbol: Palette.DarkGray,
      };
  }
}
