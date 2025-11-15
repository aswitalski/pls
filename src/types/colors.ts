import { FeedbackType, TaskType } from './types.js';

/**
 * Semantic color palette - colors organized by their purpose/meaning.
 * Prefer adding semantic names here rather than to DescriptiveColors.
 */
export const Colors = {
  Action: {
    Execute: '#5aaa8a', // green
    Discard: '#a85c3f', // dark orange
    Select: '#5c8cbc', // steel blue
  },
  Status: {
    Success: '#22aa22', // green
    Error: '#cc5c5c', // red
    Warning: '#cc9c5c', // orange
    Info: '#5c9ccc', // cyan
  },
  Label: {
    Default: '#ffffff', // white
    Inactive: '#888888', // gray
    Discarded: '#666666', // dark gray
    Skipped: '#cccc5c', // yellow
  },
  Type: {
    Config: '#5c9ccc', // cyan
    Plan: '#5ccccc', // magenta
    Execute: '#5aaa8a', // green
    Answer: '#9c5ccc', // purple
    Introspect: '#9c5ccc', // purple
    Report: '#cc9c5c', // orange
    Define: '#cc9c5c', // amber
    Ignore: '#cc7a5c', // dark orange
    Select: '#5c8cbc', // steel blue
    Discard: '#a85c3f', // dark orange
  },
} as const;

/**
 * Task-specific color mappings
 */
export const TaskColors: Record<
  TaskType,
  { description: string; type: string }
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
 * Feedback-specific color mappings
 */
export const FeedbackColors: Record<FeedbackType, string> = {
  [FeedbackType.Info]: Colors.Status.Info,
  [FeedbackType.Succeeded]: Colors.Status.Success,
  [FeedbackType.Aborted]: Colors.Status.Warning,
  [FeedbackType.Failed]: Colors.Status.Error,
} as const;
