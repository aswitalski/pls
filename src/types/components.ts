import React from 'react';

import { App, ComponentName, FeedbackType, Task } from './types.js';

import { LLMService } from '../services/anthropic.js';

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

export interface ConfirmProps {
  message: string;
  state?: ConfirmState;
  onConfirmed?: () => void;
  onCancelled?: () => void;
}

export interface ConfirmState extends BaseState {
  confirmed?: boolean;
}

export interface RefinementProps {
  text: string;
  state?: BaseState;
  onAborted: () => void;
}

export interface PlanProps {
  message?: string;
  tasks: Task[];
  state?: PlanState;
  debug?: boolean;
  onSelectionConfirmed?: (tasks: Task[]) => void | Promise<void>;
  onAborted: () => void;
}

export interface PlanState extends BaseState {
  highlightedIndex: number | null;
  currentDefineGroupIndex: number;
  completedSelections: number[];
}

export interface CommandProps {
  command: string;
  state?: CommandState;
  service?: LLMService;
  error?: string;
  children?: React.ReactNode;
  onError?: (error: string) => void;
  onComplete?: (message: string, tasks: Task[]) => void;
  onAborted: () => void;
}

export interface Capability {
  name: string;
  description: string;
  isBuiltIn: boolean;
  isIndirect?: boolean;
}

export interface ReportProps {
  message: string;
  capabilities: Capability[];
}

export interface IntrospectProps {
  tasks: Task[];
  state?: IntrospectState;
  service?: LLMService;
  children?: React.ReactNode;
  debug?: boolean;
  onError?: (error: string) => void;
  onComplete?: (message: string, capabilities: Capability[]) => void;
  onAborted: () => void;
}

export interface AnswerProps {
  question: string;
  state?: AnswerState;
  service?: LLMService;
  onError?: (error: string) => void;
  onComplete?: (answer: string) => void;
  onAborted: () => void;
}

export interface AnswerDisplayProps {
  answer: string;
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

export interface IntrospectState extends BaseState {
  isLoading?: boolean;
  error?: string;
}

export interface AnswerState extends BaseState {
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
type RefinementDefinition = StatefulDefinition<
  ComponentName.Refinement,
  RefinementProps,
  BaseState
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
type ConfirmDefinition = StatefulDefinition<
  ComponentName.Confirm,
  ConfirmProps,
  ConfirmState
>;
type IntrospectDefinition = StatefulDefinition<
  ComponentName.Introspect,
  IntrospectProps,
  IntrospectState
>;
type ReportDefinition = StatelessDefinition<ComponentName.Report, ReportProps>;
type AnswerDefinition = StatefulDefinition<
  ComponentName.Answer,
  AnswerProps,
  AnswerState
>;
type AnswerDisplayDefinition = StatelessDefinition<
  ComponentName.AnswerDisplay,
  AnswerDisplayProps
>;

// Discriminated union of all component definitions
export type ComponentDefinition =
  | WelcomeDefinition
  | ConfigDefinition
  | FeedbackDefinition
  | MessageDefinition
  | RefinementDefinition
  | PlanDefinition
  | CommandDefinition
  | ConfirmDefinition
  | IntrospectDefinition
  | ReportDefinition
  | AnswerDefinition
  | AnswerDisplayDefinition;

// Union of all stateful component definitions
export type StatefulComponentDefinition =
  | ConfigDefinition
  | RefinementDefinition
  | CommandDefinition
  | PlanDefinition
  | ConfirmDefinition
  | IntrospectDefinition
  | AnswerDefinition;
