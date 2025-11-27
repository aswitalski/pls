import { ReactNode } from 'react';

import { App, ComponentName, FeedbackType, Task } from './types.js';
import { ConfigRequirement } from './skills.js';

import { LLMService } from '../services/anthropic.js';

import { ConfigStep } from '../ui/Config.js';

// Global handlers passed to all stateful components
export interface Handlers<TState extends BaseState = BaseState> {
  onComplete: () => void;
  onAborted: (operation: string) => void;
  onError: (error: string) => void;
  addToQueue: (...items: ComponentDefinition[]) => void;
  addToTimeline: (...items: ComponentDefinition[]) => void;
  completeActive: () => void;
  updateState: (state: Partial<TState>) => void;
}

// Base state interface - all stateful components extend this
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseState {
  // Component-specific state only - no 'done' property
}

// Base props for all stateful components
export interface BaseStatefulProps<TState extends BaseState = BaseState> {
  state?: TState;
  isActive?: boolean;
  handlers?: Handlers<TState>;
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
  selectedIndex?: number;
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
  onAborted?: (operation: string) => void;
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
  children?: ReactNode;
  debug?: boolean;
}

export interface AnswerProps extends BaseStatefulProps<AnswerState> {
  question: string;
  service?: LLMService;
}

export interface ExecuteProps extends BaseStatefulProps<ExecuteState> {
  tasks: Task[];
  service?: LLMService;
}

export interface ValidateProps extends BaseStatefulProps<ValidateState> {
  missingConfig: ConfigRequirement[];
  userRequest: string;
  service?: LLMService;
  children?: ReactNode;
  debug?: boolean;
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
  commandStatuses?: Array<{
    label: string;
    command: { description: string; command: string };
    status: string;
    output?: unknown;
    startTime?: number;
    endTime?: number;
    elapsed?: number;
  }>;
}

export interface ValidateState extends BaseState {
  error?: string;
  configRequirements?: ConfigRequirement[];
  validated?: boolean;
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

// Union of all stateless component definitions
export type StatelessComponentDefinition =
  | WelcomeDefinition
  | FeedbackDefinition
  | MessageDefinition
  | ReportDefinition;

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
  | ValidateDefinition;

// Discriminated union of all component definitions
export type ComponentDefinition =
  | StatelessComponentDefinition
  | StatefulComponentDefinition;
