import { AnthropicService } from '../services/anthropic.js';

export interface AppInfo {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
}

// Props for each component type
export interface WelcomeProps {
  app: AppInfo;
}

export interface ConfigureProps {
  key?: string;
  model?: string;
  state?: ConfigureState;
  onComplete?: (config: { key: string; model: string }) => void;
}

export interface CommandProps {
  command: string;
  state?: CommandState;
  service?: AnthropicService;
  tasks?: string[];
  error?: string;
  systemPrompt?: string;
}

// Base state interface - all stateful components extend this
export interface BaseState {
  done: boolean;
}

// Component-specific states
export interface ConfigureState extends BaseState {
  step?: 'key' | 'model' | 'done';
}

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
type WelcomeDefinition = StatelessDefinition<'welcome', WelcomeProps>;
type ConfigureDefinition = StatefulDefinition<
  'configure',
  ConfigureProps,
  ConfigureState
>;
type CommandDefinition = StatefulDefinition<
  'command',
  CommandProps,
  CommandState
>;

// Discriminated union of all component definitions
export type ComponentDefinition =
  | WelcomeDefinition
  | ConfigureDefinition
  | CommandDefinition;
