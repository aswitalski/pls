// Base state interface - components extend this
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BaseState {
  // Component-specific state only
}

/**
 * Lifecycle management handlers - for components with active/pending states
 */
export interface LifecycleHandlers<TComponentDefinition = unknown> {
  completeActive: (...items: TComponentDefinition[]) => void;
  completeActiveAndPending: (...items: TComponentDefinition[]) => void;
}

/**
 * Request handlers - for managing errors, aborts, and completions.
 */
export interface RequestHandlers<TState extends BaseState> {
  onError: (error: string) => void;
  onAborted: (operation: string) => void;
  onCompleted: (state: TState) => void;
}

/**
 * Workflow handlers - manages component lifecycle, queue, and timeline
 */
export interface WorkflowHandlers<TComponentDefinition = unknown> {
  addToQueue: (...items: TComponentDefinition[]) => void;
  addToTimeline: (...items: TComponentDefinition[]) => void;
}
