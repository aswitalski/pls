export interface App {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
  isDebug: boolean;
}

export enum ComponentName {
  Welcome = 'welcome',
  Config = 'config',
  Message = 'message',
  Command = 'command',
  Plan = 'plan',
  Refinement = 'refinement',
  Feedback = 'feedback',
  Confirm = 'confirm',
  Introspect = 'introspect',
  Report = 'report',
}

export enum TaskType {
  Config = 'config',
  Plan = 'plan',
  Execute = 'execute',
  Answer = 'answer',
  Introspect = 'introspect',
  Report = 'report',
  Define = 'define',
  Ignore = 'ignore',
  Select = 'select',
  Discard = 'discard',
}

export enum FeedbackType {
  Info = 'info',
  Succeeded = 'succeeded',
  Aborted = 'aborted',
  Failed = 'failed',
}

// Structured task definition for tool-based planning
export interface Task {
  action: string;
  type: TaskType;
  params?: Record<string, unknown>;
}
