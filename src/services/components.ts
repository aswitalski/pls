import { randomUUID } from 'node:crypto';

import {
  AnswerDefinitionProps,
  AnswerState,
  BaseState,
  Capability,
  CommandDefinitionProps,
  CommandState,
  ComponentDefinition,
  ComponentStatus,
  ConfigDefinitionProps,
  ConfigState,
  ConfirmDefinitionProps,
  ConfirmState,
  ExecuteDefinitionProps,
  ExecuteState,
  IntrospectDefinitionProps,
  IntrospectState,
  RefinementDefinitionProps,
  ScheduleDefinitionProps,
  ScheduleState,
  ValidateDefinitionProps,
  ValidateState,
} from '../types/components.js';
import { App, ComponentName, FeedbackType } from '../types/types.js';

/**
 * Shared component creation utility
 */
const createComponent = (
  name: ComponentName,
  props: unknown,
  state: BaseState | undefined,
  status = ComponentStatus.Awaiting
): ComponentDefinition =>
  ({
    id: randomUUID(),
    name,
    props,
    ...(state !== undefined ? { state } : {}),
    status,
  }) as ComponentDefinition;

/**
 * Create a simple component without state
 */
const createSimpleComponent = (
  name: ComponentName,
  props: unknown,
  status?: ComponentStatus
): ComponentDefinition => createComponent(name, props, undefined, status);

/**
 * Create a managed component with state
 */
const createManagedComponent = (
  name: ComponentName,
  props: unknown,
  state: BaseState,
  status?: ComponentStatus
): ComponentDefinition => createComponent(name, props, state, status);

/**
 * Initial state constants for managed components
 */
const InitialConfigState: ConfigState = {
  values: {},
  completedStep: 0,
  selectedIndex: 0,
};

const InitialCommandState: CommandState = {
  error: null,
  message: null,
  tasks: [],
};

const InitialScheduleState: ScheduleState = {
  highlightedIndex: null,
  currentDefineGroupIndex: 0,
  completedSelections: [],
};

const InitialRefinementState: BaseState = {};

const InitialConfirmState: ConfirmState = {
  confirmed: false,
  selectedIndex: 0,
};

const InitialIntrospectState: IntrospectState = {
  error: null,
  capabilities: [],
  message: null,
};

const InitialAnswerState: AnswerState = {
  error: null,
  answer: null,
};

const InitialExecuteState: ExecuteState = {
  error: null,
  message: '',
  summary: '',
  tasks: [],
  completionMessage: null,
};

const InitialValidateState: ValidateState = {
  error: null,
  completionMessage: null,
  configRequirements: [],
  validated: false,
};

/**
 * Create a welcome component that displays application information
 */
export const createWelcome = (props: { app: App }, status?: ComponentStatus) =>
  createSimpleComponent(ComponentName.Welcome, props, status);

/**
 * Create a feedback component that displays status messages
 */
export const createFeedback = (
  props: { type: FeedbackType; message: string },
  status?: ComponentStatus
) => createSimpleComponent(ComponentName.Feedback, props, status);

/**
 * Create a message component that displays informational text
 */
export const createMessage = (
  props: { text: string },
  status?: ComponentStatus
) => createSimpleComponent(ComponentName.Message, props, status);

/**
 * Create a debug component that displays diagnostic information
 */
export const createDebug = (
  props: { title: string; content: string; color: string },
  status?: ComponentStatus
) => createSimpleComponent(ComponentName.Debug, props, status);

/**
 * Create a report component that displays capability listings
 */
export const createReport = (
  props: { message: string; capabilities: Capability[] },
  status?: ComponentStatus
) => createSimpleComponent(ComponentName.Report, props, status);

/**
 * Create a configuration component for multi-step user input
 */
export const createConfig = (
  props: ConfigDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Config,
    props,
    InitialConfigState,
    status
  );

/**
 * Create a command component that processes user requests via LLM
 */
export const createCommand = (
  props: CommandDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Command,
    props,
    InitialCommandState,
    status
  );

/**
 * Create a schedule component that displays and manages task execution plans
 */
export const createSchedule = (
  props: ScheduleDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Schedule,
    props,
    InitialScheduleState,
    status
  );

/**
 * Create a refinement component for interactive task selection
 */
export const createRefinement = (
  props: RefinementDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Refinement,
    props,
    InitialRefinementState,
    status
  );

/**
 * Create a confirmation component that prompts user for yes/no decisions
 */
export const createConfirm = (
  props: ConfirmDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Confirm,
    props,
    InitialConfirmState,
    status
  );

/**
 * Create an introspect component that lists available capabilities
 */
export const createIntrospect = (
  props: IntrospectDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Introspect,
    props,
    InitialIntrospectState,
    status
  );

/**
 * Create an answer component that responds to information requests via LLM
 */
export const createAnswer = (
  props: AnswerDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Answer,
    props,
    InitialAnswerState,
    status
  );

/**
 * Create an execute component that runs shell commands and processes operations
 */
export const createExecute = (
  props: ExecuteDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Execute,
    props,
    InitialExecuteState,
    status
  );

/**
 * Create a validate component that checks and collects missing configuration
 */
export const createValidate = (
  props: ValidateDefinitionProps,
  status?: ComponentStatus
) =>
  createManagedComponent(
    ComponentName.Validate,
    props,
    InitialValidateState,
    status
  );
