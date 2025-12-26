// Base state interface - components extend this
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseState {
  // Component-specific state only - no 'done' property
}

/**
 * State management handlers - for components tracking internal state
 * Used by: Execute, Config, Validate, Command, Schedule, Introspect, Answer,
 * Confirm
 */
export interface StateHandlers<TState extends BaseState = BaseState> {
  updateState: (state: Partial<TState>) => void;
}

/**
 * Lifecycle management handlers - for components controlling their completion
 * Used by: Execute, Config, Validate, Command, Schedule, Introspect, Answer
 */
export interface LifecycleHandlers<TComponentDefinition = unknown> {
  completeActive: (...items: TComponentDefinition[]) => void;
}

/**
 * Queue management handlers - for components spawning other components
 * Used by: Introspect
 */
export interface QueueHandlers<TComponentDefinition = unknown> {
  addToQueue: (...items: TComponentDefinition[]) => void;
}

/**
 * Error handling handlers - for components that can fail or be aborted
 * Used by: Execute, Command, Schedule, Introspect, Answer
 */
export interface ErrorHandlers {
  onError: (error: string) => void;
  onAborted: (operation: string) => void;
}

/**
 * Workflow handlers - used by Workflow.tsx and service functions
 * for timeline/queue management
 */
export interface WorkflowHandlers<TComponentDefinition = unknown> {
  completeActiveAndPending: (...items: TComponentDefinition[]) => void;
  addToTimeline: (...items: TComponentDefinition[]) => void;
}
