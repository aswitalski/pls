import React from 'react';

import { ComponentDefinition } from './components.js';

import { LLMService } from '../services/anthropic.js';
import { CommandOutput } from '../services/shell.js';

export type SetQueue = React.Dispatch<
  React.SetStateAction<ComponentDefinition[]>
>;

/**
 * Core operations shared by all handlers
 */
export interface HandlerOperations {
  addToTimeline: (...items: ComponentDefinition[]) => void;
  setQueue: SetQueue;
  service: LLMService | null;
}

/**
 * Answer handler callbacks
 */
export interface AnswerHandlers {
  onError: (error: string) => void;
  onComplete: (answer: string) => void;
  onAborted: () => void;
}

/**
 * Introspect handler callbacks
 */
export interface IntrospectHandlers {
  onError: (error: string) => void;
  onComplete: (
    message: string,
    capabilities: import('./components.js').Capability[]
  ) => void;
  onAborted: () => void;
}

/**
 * Execute handler callbacks
 */
export interface ExecuteHandlers {
  onError: (error: string) => void;
  onComplete: (outputs: CommandOutput[], totalElapsed: number) => void;
  onAborted: () => void;
}

/**
 * Execution handler callbacks
 */
export interface ExecutionHandlers {
  onConfirmed: (tasks: import('./types.js').Task[]) => void;
  onCancelled: (tasks: import('./types.js').Task[]) => void;
}

/**
 * Plan handler callbacks
 */
export interface PlanHandlers {
  onAborted: () => void;
  createAbortHandler: (tasks: import('./types.js').Task[]) => () => void;
  onSelectionConfirmed: (tasks: import('./types.js').Task[]) => Promise<void>;
}

/**
 * Command handler callbacks
 */
export interface CommandHandlers {
  onError: (error: string) => void;
  onComplete: (message: string, tasks: import('./types.js').Task[]) => void;
  onAborted: () => void;
}

/**
 * Config handler callbacks
 */
export interface ConfigHandlers {
  onFinished: (config: Record<string, string>) => void;
  onAborted: () => void;
}
