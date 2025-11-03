import { AnthropicService } from '../../src/services/anthropic.js';

/**
 * Mock implementation of AnthropicService for testing
 */
export class AnthropicServiceMock extends AnthropicService {
  private responses: Map<string, string[]> = new Map();
  private defaultResponse: string[] = ['mock task'];
  private shouldFail = false;
  private errorMessage = 'Mock error';

  /**
   * Set a specific response for a given command
   */
  setResponse(command: string, tasks: string[]): void {
    this.responses.set(command, tasks);
  }

  /**
   * Set the default response for commands without specific responses
   */
  setDefaultResponse(tasks: string[]): void {
    this.defaultResponse = tasks;
  }

  /**
   * Make the next processCommand call fail with an error
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
    this.defaultResponse = ['mock task'];
    this.shouldFail = false;
    this.errorMessage = 'Mock error';
  }

  processCommand(rawCommand: string): Promise<string[]> {
    if (this.shouldFail) {
      return Promise.reject(new Error(this.errorMessage));
    }

    const response = this.responses.get(rawCommand);
    return Promise.resolve(response ?? this.defaultResponse);
  }
}
