import React from 'react';

import { AnthropicService } from '../services/anthropic.js';

export interface AppInfo {
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

// Props for each component type
export interface WelcomeProps {
  app: AppInfo;
}

export interface ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> {
  steps: Array<{
    description: string;
    key: string;
    value: string | null;
  }>;
  state?: BaseState;
  onFinished?: (config: T) => void;
  onAborted?: () => void;
}

export interface FeedbackProps {
  type: FeedbackType;
  message: string;
}

export interface MessageProps {
  text: string;
}

export interface PlanProps {
  message?: string;
  tasks: Task[];
}

export interface CommandProps {
  command: string;
  state?: CommandState;
  service?: AnthropicService;
  error?: string;
  children?: React.ReactNode;
  onError?: (error: string) => void;
  onComplete?: (message: string, tasks: Task[]) => void;
}

// Base state interface - all stateful components extend this
export interface BaseState {
  done: boolean;
}

// Component-specific states
export interface CommandState extends BaseState {
  isLoading?: boolean;
  error?: string;
}

// Generic base definitions with shared properties

// For components without state tracking
interface StatelessDefinition<ComponentName extends string, ComponentProps> {
  name: ComponentName;
  props: ComponentProps;
}

// For components with state tracking
interface StatefulDefinition<
  ComponentName extends string,
  ComponentProps,
  ComponentState extends BaseState,
> {
  name: ComponentName;
  state: ComponentState;
  props: ComponentProps;
}

// Specific component definitions
type WelcomeDefinition = StatelessDefinition<
  ComponentName.Welcome,
  WelcomeProps
>;
type ConfigDefinition = StatefulDefinition<
  ComponentName.Config,
  ConfigProps,
  BaseState
>;
type FeedbackDefinition = StatelessDefinition<
  ComponentName.Feedback,
  FeedbackProps
>;
type MessageDefinition = StatelessDefinition<
  ComponentName.Message,
  MessageProps
>;
type PlanDefinition = StatelessDefinition<ComponentName.Plan, PlanProps>;
type CommandDefinition = StatefulDefinition<
  ComponentName.Command,
  CommandProps,
  CommandState
>;

// Discriminated union of all component definitions
export type ComponentDefinition =
  | WelcomeDefinition
  | ConfigDefinition
  | FeedbackDefinition
  | MessageDefinition
  | PlanDefinition
  | CommandDefinition;

// Union of all stateful component definitions
export type StatefulComponentDefinition = ConfigDefinition | CommandDefinition;
