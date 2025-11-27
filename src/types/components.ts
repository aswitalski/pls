import React from 'react';

import { App, ComponentName, FeedbackType, Task } from './types.js';

import { LLMService } from '../services/anthropic.js';
import { CommandOutput } from '../services/shell.js';
import { ConfigRequirement } from './skills.js';

import { ConfigStep } from '../ui/Config.js';

// Global handlers passed to all stateful components
export interface Handlers {
  onComplete: () => void;
  onAborted: (operation: string) => void;
  onError: (error: string) => void;
  addToQueue?: (...items: ComponentDefinition[]) => void;
}

// Base state interface - all stateful components extend this
export interface BaseState {
  // Component-specific state only - no 'done' property
}

// Base props for all stateful components
export interface BaseStatefulProps<TState extends BaseState = BaseState> {
  state?: TState;
  isActive?: boolean;
  handlers?: Handlers;
}

// Props for each component type
export interface WelcomeProps {
  app: App;
}

export interface ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> extends BaseStatefulProps {
  steps: ConfigStep[];
  onFinished?: (config: T) => void;
  onAborted?: (operation: string) => void;
}

export interface FeedbackProps {
  type: FeedbackType;
  message: string;
}

export interface MessageProps {
  text: string;
}

export interface ConfirmProps extends BaseStatefulProps<ConfirmState> {
  message: string;
  onConfirmed?: () => void;
  onCancelled?: () => void;
}

export interface ConfirmState extends BaseState {
  confirmed?: boolean;
}

export interface RefinementProps extends BaseStatefulProps {
  text: string;
  onAborted: (operation: string) => void;
}

export interface PlanProps extends BaseStatefulProps<PlanState> {
  message?: string;
  tasks: Task[];
  debug?: boolean;
  onSelectionConfirmed?: (tasks: Task[]) => void | Promise<void>;
  onAborted?: (operation: string) => void; // TODO: Remove from tests, uses handlers now
}

export interface PlanState extends BaseState {
  highlightedIndex: number | null;
  currentDefineGroupIndex: number;
  completedSelections: number[];
}

export interface CommandProps extends BaseStatefulProps<CommandState> {
  command: string;
  service?: LLMService;
  error?: string;
  children?: React.ReactNode;
  onError?: (error: string) => void;
  onComplete?: (message: string, tasks: Task[]) => void;
  onAborted: (operation: string) => void;
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

export interface IntrospectProps extends BaseStatefulProps<IntrospectState> {
  tasks: Task[];
  service?: LLMService;
  children?: React.ReactNode;
  debug?: boolean;
}

export interface AnswerProps extends BaseStatefulProps<AnswerState> {
  question: string;
  service?: LLMService;
  onError?: (error: string) => void;
  onComplete?: (answer: string) => void;
  onAborted: (operation: string) => void;
}

export interface AnswerDisplayProps {
  answer: string;
}

export interface ExecuteProps extends BaseStatefulProps<ExecuteState> {
  tasks: Task[];
  service?: LLMService;
  onError?: (error: string) => void;
  onComplete?: (outputs: CommandOutput[], totalElapsed: number) => void;
  onAborted: (operation: string, elapsedTime: number) => void;
}

export interface ValidateProps extends BaseStatefulProps<ValidateState> {
  missingConfig: ConfigRequirement[];
  userRequest: string;
  service?: LLMService;
  children?: React.ReactNode;
  onError?: (error: string) => void;
  onComplete?: (configWithDescriptions: ConfigRequirement[]) => void;
  onAborted: (operation: string) => void;
}

// Component-specific states
export interface CommandState extends BaseState {
  error?: string;
  message?: string;
  tasks?: Task[];
}

export interface IntrospectState extends BaseState {
  isLoading?: boolean;
  error?: string;
}

export interface AnswerState extends BaseState {
  isLoading?: boolean;
  error?: string;
}

export interface ExecuteState extends BaseState {
  isLoading?: boolean;
  error?: string;
}

export interface ValidateState extends BaseState {
  isLoading?: boolean;
  error?: string;
}

export interface ProgressProps extends BaseStatefulProps<ProgressState> {
  message: string;
}

export interface ProgressState extends BaseState {
  // No additional state needed for Progress component
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
type ExecuteDefinition = StatefulDefinition<
  ComponentName.Execute,
  ExecuteProps,
  ExecuteState
>;
type ValidateDefinition = StatefulDefinition<
  ComponentName.Validate,
  ValidateProps,
  ValidateState
>;
type ProgressDefinition = StatefulDefinition<
  ComponentName.Progress,
  ProgressProps,
  ProgressState
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
  | AnswerDisplayDefinition
  | ExecuteDefinition
  | ValidateDefinition
  | ProgressDefinition;

// Union of all stateful component definitions
export type StatefulComponentDefinition =
  | ConfigDefinition
  | RefinementDefinition
  | CommandDefinition
  | PlanDefinition
  | ConfirmDefinition
  | IntrospectDefinition
  | AnswerDefinition
  | ExecuteDefinition
  | ValidateDefinition
  | ProgressDefinition;
