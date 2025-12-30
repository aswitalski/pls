import { ReactNode } from 'react';

import { DebugLevel } from '../configuration/types.js';
import { App, ComponentName, FeedbackType, Origin, Task } from './types.js';
import {
  BaseState,
  LifecycleHandlers,
  RequestHandlers,
  WorkflowHandlers,
} from './handlers.js';
import { ConfigRequirement } from './skills.js';

import { ExecuteCommand, LLMService } from '../services/anthropic.js';
import { ExecutionStatus } from '../services/shell.js';

import { ConfigStep } from '../ui/Config.js';

// Re-export handlers for convenience
export type { BaseState, LifecycleHandlers, RequestHandlers, WorkflowHandlers };

// Component lifecycle status
export enum ComponentStatus {
  Awaiting = 'awaiting', // In queue, not rendered
  Active = 'active', // Currently interactive, accepts input
  Pending = 'pending', // Visible but waiting for next action
  Done = 'done', // Completed, in Static timeline
}

// Utility type to combine definition props with runtime props
export type ComponentProps<TDefinitionProps> = TDefinitionProps & {
  status: ComponentStatus;
  debug?: DebugLevel;
};

// For async components that use early return pattern and need payload
export type AsyncComponentProps<
  TDefinitionProps,
  TState extends BaseState,
> = ComponentProps<TDefinitionProps> & {
  payload: TState;
};

// ============================================================================
// STATELESS COMPONENTS (Props only, no state)
// ============================================================================

export interface WelcomeDefinitionProps {
  app: App;
}

export type WelcomeProps = ComponentProps<WelcomeDefinitionProps>;

export interface FeedbackDefinitionProps {
  type: FeedbackType;
  message: string;
}

export type FeedbackProps = ComponentProps<FeedbackDefinitionProps>;

export interface MessageDefinitionProps {
  text: string;
}

export type MessageProps = ComponentProps<MessageDefinitionProps>;

export interface DebugDefinitionProps {
  title: string;
  content: string;
  color: string;
}

export type DebugProps = ComponentProps<DebugDefinitionProps>;

export interface Capability {
  name: string;
  description: string;
  origin: Origin;
  isIncomplete?: boolean;
}

export interface ReportDefinitionProps {
  message: string;
  capabilities: Capability[];
}

export type ReportProps = ComponentProps<ReportDefinitionProps>;

// ============================================================================
// STATEFUL COMPONENTS (Props + State, one by one)
// ============================================================================

export interface RefinementDefinitionProps {
  text: string;
  onAborted: (operation: string) => void;
}

export type RefinementProps = ComponentProps<RefinementDefinitionProps> & {
  requestHandlers: RequestHandlers<BaseState>;
};

export interface ConfigDefinitionProps<
  T extends Record<string, string> = Record<string, string>,
> {
  steps: ConfigStep[];
  onFinished?: (config: T) => void;
  onAborted?: (operation: string) => void;
}

export type ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> = ComponentProps<ConfigDefinitionProps<T>> & {
  requestHandlers: RequestHandlers<ConfigState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
};

export interface ConfigState extends BaseState {
  values: Record<string, string>;
  completedStep: number;
  selectedIndex: number;
}

export interface ConfirmDefinitionProps {
  message: string;
  onConfirmed: VoidFunction;
  onCancelled: VoidFunction;
}

export type ConfirmProps = ComponentProps<ConfirmDefinitionProps> & {
  requestHandlers: RequestHandlers<ConfirmState>;
};

export interface ConfirmState extends BaseState {
  confirmed: boolean;
  selectedIndex: number;
}

export interface ScheduleDefinitionProps {
  message: string;
  tasks: Task[];
  onSelectionConfirmed?: (tasks: Task[]) => void | Promise<void>;
}

export type ScheduleProps = ComponentProps<ScheduleDefinitionProps> & {
  requestHandlers: RequestHandlers<ScheduleState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
};

export interface ScheduleState extends BaseState {
  highlightedIndex: number | null;
  currentDefineGroupIndex: number;
  completedSelections: number[];
}

export interface CommandDefinitionProps {
  command: string;
  service: LLMService;
  onAborted?: (operation: string) => void;
}

export type CommandProps = ComponentProps<CommandDefinitionProps> & {
  requestHandlers: RequestHandlers<CommandState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
};

export interface CommandState extends BaseState {
  error: string | null;
  message: string | null;
  tasks: Task[];
}

export interface IntrospectDefinitionProps {
  tasks: Task[];
  service: LLMService;
  children?: ReactNode;
}

export type IntrospectProps = ComponentProps<IntrospectDefinitionProps> & {
  requestHandlers: RequestHandlers<IntrospectState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
};

export interface IntrospectState extends BaseState {
  error: string | null;
  capabilities: Capability[];
  message: string | null;
}

export interface AnswerDefinitionProps {
  question: string;
  service: LLMService;
}

export type AnswerProps = ComponentProps<AnswerDefinitionProps> & {
  requestHandlers: RequestHandlers<AnswerState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
};

export interface AnswerState extends BaseState {
  error: string | null;
  answer: string | null;
}

export interface TaskInfo {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  elapsed: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface ExecuteDefinitionProps {
  tasks: Task[];
  service: LLMService;
}

export type ExecuteProps = ComponentProps<ExecuteDefinitionProps> & {
  requestHandlers: RequestHandlers<ExecuteState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
};

export interface ExecuteState extends BaseState {
  error: string | null;
  message: string;
  summary: string;
  tasks: TaskInfo[];
  completed: number;
  completionMessage: string | null;
}

export interface ValidateDefinitionProps {
  missingConfig: ConfigRequirement[];
  userRequest: string;
  service: LLMService;
  onError: (error: string) => void;
  onValidationComplete: (configWithDescriptions: ConfigRequirement[]) => void;
  onAborted: (operation: string) => void;
}

export type ValidateProps = ComponentProps<ValidateDefinitionProps> & {
  requestHandlers: RequestHandlers<ValidateState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
};

export interface ValidateState extends BaseState {
  error: string | null;
  completionMessage: string | null;
  configRequirements: ConfigRequirement[];
  validated: boolean;
}

// Generic base definitions with shared properties

// For components that render immediately (no lifecycle management)
interface SimpleDefinition<ComponentName extends string, ComponentProps> {
  id: string;
  name: ComponentName;
  props: ComponentProps;
  status: ComponentStatus;
}

// For components that need lifecycle management (queued, activated, completed)
interface ManagedDefinition<
  ComponentName extends string,
  ComponentProps,
  ComponentState extends BaseState,
> {
  id: string;
  name: ComponentName;
  state: ComponentState;
  props: ComponentProps;
  status: ComponentStatus;
}

// Specific component definitions
type WelcomeDefinition = SimpleDefinition<
  ComponentName.Welcome,
  WelcomeDefinitionProps
>;
type ConfigDefinition = ManagedDefinition<
  ComponentName.Config,
  ConfigDefinitionProps,
  ConfigState
>;
type FeedbackDefinition = SimpleDefinition<
  ComponentName.Feedback,
  FeedbackDefinitionProps
>;
type MessageDefinition = SimpleDefinition<
  ComponentName.Message,
  MessageDefinitionProps
>;
type DebugDefinition = SimpleDefinition<
  ComponentName.Debug,
  DebugDefinitionProps
>;
type RefinementDefinition = ManagedDefinition<
  ComponentName.Refinement,
  RefinementDefinitionProps,
  BaseState
>;
type ScheduleDefinition = ManagedDefinition<
  ComponentName.Schedule,
  ScheduleDefinitionProps,
  ScheduleState
>;
type CommandDefinition = ManagedDefinition<
  ComponentName.Command,
  CommandDefinitionProps,
  CommandState
>;
type ConfirmDefinition = ManagedDefinition<
  ComponentName.Confirm,
  ConfirmDefinitionProps,
  ConfirmState
>;
type IntrospectDefinition = ManagedDefinition<
  ComponentName.Introspect,
  IntrospectDefinitionProps,
  IntrospectState
>;
type ReportDefinition = SimpleDefinition<
  ComponentName.Report,
  ReportDefinitionProps
>;
type AnswerDefinition = ManagedDefinition<
  ComponentName.Answer,
  AnswerDefinitionProps,
  AnswerState
>;
type ExecuteDefinition = ManagedDefinition<
  ComponentName.Execute,
  ExecuteDefinitionProps,
  ExecuteState
>;
type ValidateDefinition = ManagedDefinition<
  ComponentName.Validate,
  ValidateDefinitionProps,
  ValidateState
>;

// Union of all simple component definitions
export type SimpleComponentDefinition =
  | WelcomeDefinition
  | FeedbackDefinition
  | MessageDefinition
  | DebugDefinition
  | ReportDefinition;

// Union of all managed component definitions
export type ManagedComponentDefinition =
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
  | SimpleComponentDefinition
  | ManagedComponentDefinition;
