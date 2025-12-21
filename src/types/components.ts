import { ReactNode } from 'react';

import { App, ComponentName, FeedbackType, Task } from './types.js';
import { ConfigRequirement } from './skills.js';

import { LLMService } from '../services/anthropic.js';
import { DebugLevel } from '../services/configuration.js';

import { ConfigStep } from '../ui/Config.js';

// Component lifecycle status
export enum ComponentStatus {
  Awaiting = 'awaiting', // In queue, not rendered
  Active = 'active', // Currently interactive, accepts input
  Pending = 'pending', // Visible but waiting for next action
  Done = 'done', // Completed, in Static timeline
}

// Global handlers passed to all stateful components
export interface Handlers<TState extends BaseState = BaseState> {
  addToQueue: (...items: ComponentDefinition[]) => void;
  updateState: (state: Partial<TState>) => void;
  completeActive: (...items: ComponentDefinition[]) => void;
  completeActiveAndPending: (...items: ComponentDefinition[]) => void;
  addToTimeline: (...items: ComponentDefinition[]) => void;
  onAborted: (operation: string) => void;
  onError: (error: string) => void;
}

// Base state interface - all stateful components extend this
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseState {
  // Component-specific state only - no 'done' property
}

// Runtime-only props (injected during rendering)
export interface BaseRuntimeProps<TState extends BaseState = BaseState> {
  state?: TState;
  status?: ComponentStatus;
  handlers?: Handlers<TState>;
}

// Utility type to combine definition props with runtime props
export type ComponentProps<
  TDefinitionProps,
  TState extends BaseState,
> = TDefinitionProps & BaseRuntimeProps<TState>;

// Props for each component type
export interface WelcomeDefinitionProps {
  app: App;
}

export type WelcomeProps = WelcomeDefinitionProps & BaseRuntimeProps;

export type ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> = ComponentProps<ConfigDefinitionProps<T>, BaseState>;

export interface FeedbackDefinitionProps {
  type: FeedbackType;
  message: string;
}

export type FeedbackProps = FeedbackDefinitionProps & BaseRuntimeProps;

export interface MessageDefinitionProps {
  text: string;
}

export type MessageProps = MessageDefinitionProps & BaseRuntimeProps;

export interface DebugDefinitionProps {
  title: string;
  content: string;
  color: string;
}

export type DebugProps = DebugDefinitionProps & BaseRuntimeProps;

export type ConfirmProps = ComponentProps<ConfirmDefinitionProps, ConfirmState>;

export interface ConfirmState extends BaseState {
  confirmed?: boolean;
  selectedIndex?: number;
}

export type RefinementProps = ComponentProps<
  RefinementDefinitionProps,
  BaseState
>;

export type ScheduleProps = ComponentProps<
  ScheduleDefinitionProps,
  ScheduleState
>;

export interface ScheduleState extends BaseState {
  highlightedIndex: number | null;
  currentDefineGroupIndex: number;
  completedSelections: number[];
}

export type CommandProps = ComponentProps<CommandDefinitionProps, CommandState>;

export interface Capability {
  name: string;
  description: string;
  isBuiltIn: boolean;
  isIndirect?: boolean;
  isIncomplete?: boolean;
}

export interface ReportDefinitionProps {
  message: string;
  capabilities: Capability[];
}

export type ReportProps = ReportDefinitionProps & BaseRuntimeProps;

export type IntrospectProps = ComponentProps<
  IntrospectDefinitionProps,
  IntrospectState
>;

export type AnswerProps = ComponentProps<AnswerDefinitionProps, AnswerState>;

export type ExecuteProps = ComponentProps<ExecuteDefinitionProps, ExecuteState>;

export type ValidateProps = ComponentProps<
  ValidateDefinitionProps,
  ValidateState
>;

// Component-specific states
export interface CommandState extends BaseState {
  error?: string;
  message?: string;
  tasks?: Task[];
}

export interface IntrospectState extends BaseState {
  error?: string;
  capabilities?: Capability[];
  message?: string;
}

export interface AnswerState extends BaseState {
  error?: string;
  answer?: string;
}

export interface ExecuteState extends BaseState {
  error?: string | null;
  message?: string;
  summary?: string;
  taskInfos?: Array<{
    label: string;
    command: { description: string; command: string };
  }>;
  activeTaskIndex?: number;
  taskExecutionTimes?: number[];
  completionMessage?: string | null;
}

export interface ValidateState extends BaseState {
  error?: string;
  configRequirements?: ConfigRequirement[];
  validated?: boolean;
}

// Definition props (stored in component definitions, excludes runtime props)
export interface ConfigDefinitionProps<
  T extends Record<string, string> = Record<string, string>,
> {
  steps: ConfigStep[];
  onFinished: (config: T) => void;
  onAborted: (operation: string) => void;
}

export interface ConfirmDefinitionProps {
  message: string;
  onConfirmed: VoidFunction;
  onCancelled: VoidFunction;
}

export interface RefinementDefinitionProps {
  text: string;
  onAborted: (operation: string) => void;
}

export interface ScheduleDefinitionProps {
  message: string;
  tasks: Task[];
  debug?: DebugLevel;
  onSelectionConfirmed?: (tasks: Task[]) => void | Promise<void>;
}

export interface CommandDefinitionProps {
  command: string;
  service: LLMService;
  error?: string;
  onAborted?: (operation: string) => void;
}

export interface IntrospectDefinitionProps {
  tasks: Task[];
  service: LLMService;
  children?: ReactNode;
  debug?: DebugLevel;
}

export interface AnswerDefinitionProps {
  question: string;
  service: LLMService;
}

export interface ExecuteDefinitionProps {
  tasks: Task[];
  service: LLMService;
}

export interface ValidateDefinitionProps {
  missingConfig: ConfigRequirement[];
  userRequest: string;
  service: LLMService;
  children?: ReactNode;
  debug?: DebugLevel;
  onError: (error: string) => void;
  onComplete: (configWithDescriptions: ConfigRequirement[]) => void;
  onAborted: (operation: string) => void;
}

// Generic base definitions with shared properties

// For components without state tracking
interface StatelessDefinition<ComponentName extends string, ComponentProps> {
  id: string;
  name: ComponentName;
  props: ComponentProps;
  status?: ComponentStatus;
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
  status?: ComponentStatus;
}

// Specific component definitions
type WelcomeDefinition = StatelessDefinition<
  ComponentName.Welcome,
  WelcomeDefinitionProps
>;
type ConfigDefinition = StatefulDefinition<
  ComponentName.Config,
  ConfigDefinitionProps,
  BaseState
>;
type FeedbackDefinition = StatelessDefinition<
  ComponentName.Feedback,
  FeedbackDefinitionProps
>;
type MessageDefinition = StatelessDefinition<
  ComponentName.Message,
  MessageDefinitionProps
>;
type DebugDefinition = StatelessDefinition<
  ComponentName.Debug,
  DebugDefinitionProps
>;
type RefinementDefinition = StatefulDefinition<
  ComponentName.Refinement,
  RefinementDefinitionProps,
  BaseState
>;
type ScheduleDefinition = StatefulDefinition<
  ComponentName.Schedule,
  ScheduleDefinitionProps,
  ScheduleState
>;
type CommandDefinition = StatefulDefinition<
  ComponentName.Command,
  CommandDefinitionProps,
  CommandState
>;
type ConfirmDefinition = StatefulDefinition<
  ComponentName.Confirm,
  ConfirmDefinitionProps,
  ConfirmState
>;
type IntrospectDefinition = StatefulDefinition<
  ComponentName.Introspect,
  IntrospectDefinitionProps,
  IntrospectState
>;
type ReportDefinition = StatelessDefinition<
  ComponentName.Report,
  ReportDefinitionProps
>;
type AnswerDefinition = StatefulDefinition<
  ComponentName.Answer,
  AnswerDefinitionProps,
  AnswerState
>;
type ExecuteDefinition = StatefulDefinition<
  ComponentName.Execute,
  ExecuteDefinitionProps,
  ExecuteState
>;
type ValidateDefinition = StatefulDefinition<
  ComponentName.Validate,
  ValidateDefinitionProps,
  ValidateState
>;

// Union of all stateless component definitions
export type StatelessComponentDefinition =
  | WelcomeDefinition
  | FeedbackDefinition
  | MessageDefinition
  | DebugDefinition
  | ReportDefinition;

// Union of all stateful component definitions
export type StatefulComponentDefinition =
  | ConfigDefinition
  | RefinementDefinition
  | CommandDefinition
  | ScheduleDefinition
  | ConfirmDefinition
  | IntrospectDefinition
  | AnswerDefinition
  | ExecuteDefinition
  | ValidateDefinition;

// Discriminated union of all component definitions
export type ComponentDefinition =
  | StatelessComponentDefinition
  | StatefulComponentDefinition;
