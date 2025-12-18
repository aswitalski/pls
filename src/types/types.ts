import { DebugLevel } from '../services/configuration.js';

export interface App {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
  debug: DebugLevel;
}

export enum ComponentName {
  Welcome = 'welcome',
  Config = 'config',
  Message = 'message',
  Debug = 'debug',
  Command = 'command',
  Schedule = 'schedule',
  Refinement = 'refinement',
  Feedback = 'feedback',
  Confirm = 'confirm',
  Introspect = 'introspect',
  Report = 'report',
  Answer = 'answer',
  Execute = 'execute',
  Validate = 'validate',
}

export enum TaskType {
  Config = 'configure',
  Schedule = 'schedule',
  Execute = 'execute',
  Answer = 'answer',
  Introspect = 'introspect',
  Report = 'report',
  Define = 'define',
  Ignore = 'ignore',
  Select = 'select',
  Discard = 'discard',
  Group = 'group',
}

export enum FeedbackType {
  Info = 'info',
  Succeeded = 'succeeded',
  Aborted = 'aborted',
  Failed = 'failed',
}

export type ExitCode = 0 | 1;

// Structured task definition for tool-based planning
export interface Task {
  action: string;
  type: TaskType;
  params?: Record<string, unknown>;
  config?: string[];
}

// Hierarchical task definition with recursive subtasks
export interface ScheduledTask {
  action: string;
  type: TaskType;
  params?: Record<string, unknown>;
  config?: string[];
  subtasks?: ScheduledTask[];
}
