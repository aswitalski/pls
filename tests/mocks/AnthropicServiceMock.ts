import type { Task } from '../../src/types/types.js';
import { TaskType } from '../../src/types/types.js';

import {
  AnthropicService,
  CommandResult,
} from '../../src/services/anthropic.js';

/**
 * Mock implementation of AnthropicService for testing
 */
export class AnthropicServiceMock extends AnthropicService {
  private responses: Map<string, Task[]> = new Map();
  private defaultResponse: Task[] = [
    { action: 'mock task', type: TaskType.Execute, config: [] },
  ];
  private defaultMessage = 'Mock response';
  private shouldFail = false;
  private errorMessage = 'Mock error';

  /**
   * Set a specific response for a given command
   */
  setResponse(command: string, tasks: Task[]): void {
    this.responses.set(command, tasks);
  }

  /**
   * Set the default response for commands without specific responses
   */
  setDefaultResponse(tasks: Task[]): void {
    this.defaultResponse = tasks;
  }

  /**
   * Make the next processWithTool call fail with an error
   */
  setShouldFail(fail: boolean, message = 'Mock error'): void {
    this.shouldFail = fail;
    this.errorMessage = message;
  }

  /**
   * Clear all configured responses
   */
  reset(): void {
    this.responses.clear();
    this.defaultResponse = [
      { action: 'mock task', type: TaskType.Execute, config: [] },
    ];
    this.shouldFail = false;
    this.errorMessage = 'Mock error';
  }

  processWithTool(command: string, _toolName: string): Promise<CommandResult> {
    if (this.shouldFail) {
      return Promise.reject(new Error(this.errorMessage));
    }

    const response = this.responses.get(command);
    return Promise.resolve({
      message: this.defaultMessage,
      tasks: response ?? this.defaultResponse,
    });
  }
}
