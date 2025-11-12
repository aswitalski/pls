import React from 'react';

import { App, ComponentName, FeedbackType, Task } from './types.js';

import { AnthropicService } from '../services/anthropic.js';

import { ConfigStep } from '../ui/Config.js';

// Props for each component type
export interface WelcomeProps {
  app: App;
}

export interface ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> {
  steps: ConfigStep[];
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
  state?: PlanState;
  onSelectionConfirmed?: (selectedIndex: number, tasks: Task[]) => void;
}

export interface PlanState extends BaseState {
  highlightedIndex: number | null;
  currentDefineGroupIndex: number;
  completedSelections: number[];
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
  id: string;
  name: ComponentName;
  props: ComponentProps;
}

// For components with state tracking
interface StatefulDefinition<
  ComponentName extends string,
  ComponentProps,
  ComponentState extends BaseState,
> {
  id: string;
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
type PlanDefinition = StatefulDefinition<
  ComponentName.Plan,
  PlanProps,
  PlanState
>;
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
export type StatefulComponentDefinition =
  | ConfigDefinition
  | CommandDefinition
  | PlanDefinition;
