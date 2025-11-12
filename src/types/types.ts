export interface App {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
}

export enum ComponentName {
  Welcome = 'welcome',
  Config = 'config',
  Feedback = 'feedback',
  Message = 'message',
  Plan = 'plan',
  Command = 'command',
}

export enum TaskType {
  Config = 'config',
  Plan = 'plan',
  Execute = 'execute',
  Answer = 'answer',
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
