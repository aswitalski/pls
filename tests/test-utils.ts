import { existsSync, rmSync } from 'fs';
import { vi } from 'vitest';

import type {
  BaseState,
  Capability,
  ComponentDefinition,
  ErrorHandlers,
  LifecycleHandlers,
  QueueHandlers,
  StateHandlers,
  WorkflowHandlers,
} from '../src/types/components.js';
import type { Task } from '../src/types/types.js';

import { ComponentStatus } from '../src/types/components.js';
import { ComponentName } from '../src/types/types.js';

import type {
  CommandResult,
  ExecuteCommand,
  IntrospectResult,
  LLMService,
} from '../src/services/anthropic.js';

/**
 * Test input key constants for stdin.write()
 *
 * These constants represent ANSI escape sequences and special keys
 * used in terminal interactions during testing.
 */
export const Keys = {
  Enter: '\r',
  Tab: '\t',
  Escape: '\x1B',
  ArrowUp: '\x1B[A',
  ArrowDown: '\x1B[B',
  ArrowLeft: '\x1B[D',
  ArrowRight: '\x1B[C',
} as const;

/**
 * Creates a mock LLM service for testing.
 *
 * @param result - The result to return from processWithTool
 * @param error - Optional error to throw instead of returning result
 * @returns A mock LLMService instance
 */
export function createMockAnthropicService(
  result: {
    message?: string;
    summary?: string;
    tasks?: Task[];
    capabilities?: Capability[];
    answer?: string;
    commands?: ExecuteCommand[];
    debug?: ComponentDefinition[];
  } = {},
  error?: Error
): LLMService {
  return {
    processWithTool(
      _command: string,
      toolName: string
    ): Promise<CommandResult | IntrospectResult> {
      if (error) {
        return Promise.reject(error);
      }
      if (toolName === 'introspect' && result.capabilities) {
        return Promise.resolve({
          message: result.message || '',
          capabilities: result.capabilities,
          debug: result.debug,
        });
      }
      return Promise.resolve({
        message: result.message || '',
        summary: result.summary,
        tasks: result.tasks || [],
        answer: result.answer,
        commands: result.commands,
        debug: result.debug,
      });
    },
  } as LLMService;
}

/**
 * Creates mock debug components for testing.
 *
 * @param toolName - The name of the tool (e.g., 'execute', 'answer')
 * @returns Array of mock debug components
 */
export function createMockDebugComponents(
  toolName: string
): ComponentDefinition[] {
  return [
    {
      id: `debug-prompt-${toolName}`,
      name: ComponentName.Debug,
      status: ComponentStatus.Done,
      props: {
        title: `SYSTEM PROMPT (${toolName})`,
        content: `Tool: ${toolName}`,
        color: '#ffffff',
      },
    },
    {
      id: `debug-response-${toolName}`,
      name: ComponentName.Debug,
      status: ComponentStatus.Done,
      props: {
        title: `LLM RESPONSE (${toolName})`,
        content: `Response from ${toolName} tool`,
        color: '#ffffff',
      },
    },
  ];
}

/**
 * Safely removes a directory with retry logic and error handling.
 *
 * This utility addresses intermittent ENOTEMPTY errors that can occur when
 * cleaning up test directories, especially on systems where file system
 * operations have timing delays or when processes hold temporary file handles.
 *
 * Usage in tests:
 * ```typescript
 * import { safeRemoveDirectory } from './test-utils';
 *
 * afterEach(() => {
 *   safeRemoveDirectory(tempDir);
 * });
 * ```
 *
 * @param path - The directory path to remove
 * @param maxRetries - Number of retry attempts (default: 3)
 */
export function safeRemoveDirectory(
  path: string,
  maxRetries: number = 3
): void {
  if (!existsSync(path)) {
    return;
  }

  try {
    rmSync(path, { recursive: true, force: true, maxRetries });
  } catch (error) {
    // Ignore cleanup errors - temp directories will be cleaned by OS
    // Log warning for debugging purposes
    console.warn(`Failed to clean up directory ${path}:`, error);
  }
}

/**
 * Creates mock StateHandlers for testing state management.
 *
 * @param overrides - Partial state handlers to override default mocks
 * @returns A StateHandlers mock object
 */
export function createStateHandlers<T extends BaseState = BaseState>(
  overrides?: Partial<StateHandlers<T>>
): StateHandlers<T> {
  return {
    updateState: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates mock LifecycleHandlers for testing component lifecycle.
 *
 * @param overrides - Partial lifecycle handlers to override default mocks
 * @returns A LifecycleHandlers mock object
 */
export function createLifecycleHandlers<TComponentDefinition = unknown>(
  overrides?: Partial<LifecycleHandlers<TComponentDefinition>>
): LifecycleHandlers<TComponentDefinition> {
  return {
    completeActive: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates mock QueueHandlers for testing queue management.
 *
 * @param overrides - Partial queue handlers to override default mocks
 * @returns A QueueHandlers mock object
 */
export function createQueueHandlers<TComponentDefinition = unknown>(
  overrides?: Partial<QueueHandlers<TComponentDefinition>>
): QueueHandlers<TComponentDefinition> {
  return {
    addToQueue: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates mock ErrorHandlers for testing error handling.
 *
 * @param overrides - Partial error handlers to override default mocks
 * @returns An ErrorHandlers mock object
 */
export function createErrorHandlers(
  overrides?: Partial<ErrorHandlers>
): ErrorHandlers {
  return {
    onError: vi.fn(),
    onAborted: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock WorkflowHandlers object for testing with workflow methods
 * like completeActiveAndPending and addToTimeline.
 *
 * @param overrides - Partial workflow handlers to override default mocks
 * @returns A mock WorkflowHandlers object
 */
export function createWorkflowHandlers<TComponentDefinition = unknown>(
  overrides?: Partial<WorkflowHandlers<TComponentDefinition>>
): WorkflowHandlers<TComponentDefinition> {
  return {
    completeActiveAndPending: vi.fn(),
    addToTimeline: vi.fn(),
    ...overrides,
  };
}
