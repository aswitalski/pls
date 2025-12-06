import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Answer } from '../../src/ui/Answer.js';

import {
  createMockAnthropicService,
  createMockHandlers,
} from '../test-utils.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../src/services/timing.js', () => ({
  ensureMinimumTime: vi.fn().mockResolvedValue(undefined),
  withMinimumTime: vi
    .fn()
    .mockImplementation(async (operation) => await operation()),
}));

describe('Answer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching answer', () => {
    const service = createMockAnthropicService({
      answer: 'The 55 inch Samsung The Frame costs around $1,500.',
    });

    const { lastFrame } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        handlers={createMockHandlers()}
      />
    );

    expect(lastFrame()).toContain('Finding answer.');
  });

  it('displays question and answer when done', () => {
    const service = createMockAnthropicService({
      answer: 'The 55 inch Samsung The Frame costs around $1,500.',
    });

    const { lastFrame } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        state={{ answer: 'The 55 inch Samsung The Frame costs around $1,500.' }}
        isActive={false}
        service={service}
        handlers={createMockHandlers()}
      />
    );

    const output = lastFrame();
    expect(output).toContain('What is the price of Samsung The Frame 55 inch?');
    expect(output).toContain(
      'The 55 inch Samsung The Frame costs around $1,500.'
    );
  });

  it('calls completeActive when successful', async () => {
    const answer = 'The 55 inch Samsung The Frame costs around $1,500.';
    const service = createMockAnthropicService({ answer });
    const completeActive = vi.fn();

    const { lastFrame } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        handlers={createMockHandlers({ completeActive })}
      />
    );

    // Wait for async processing
    await vi.waitFor(
      () => {
        expect(completeActive).toHaveBeenCalled();
      },
      { timeout: 500 }
    );

    // Should display the answer
    const output = lastFrame();
    expect(output).toContain(answer);
  });

  it('calls onError when service fails', async () => {
    const errorMessage = 'Network error';
    const service = createMockAnthropicService({}, new Error(errorMessage));
    const onError = vi.fn();

    render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        handlers={createMockHandlers({ onError })}
      />
    );

    // Wait for async processing (minimum 1000ms processing time)
    await vi.waitFor(
      () => {
        expect(onError).toHaveBeenCalledWith(errorMessage);
      },
      { timeout: 500 }
    );
  });

  it('handles escape key to abort', () => {
    const service = createMockAnthropicService({
      answer: 'The 55 inch Samsung The Frame costs around $1,500.',
    });
    const onAborted = vi.fn();

    const { stdin } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        handlers={createMockHandlers({ onAborted })}
      />
    );

    stdin.write('\x1b'); // Escape key

    expect(onAborted).toHaveBeenCalledWith('answer');
  });

  it('uses withMinimumTime for UX polish', async () => {
    const { withMinimumTime } = await import('../../src/services/timing.js');
    const answer = 'Quick answer';
    const service = createMockAnthropicService({ answer });
    const completeActive = vi.fn();

    render(
      <Answer
        question="Quick question?"
        service={service}
        handlers={createMockHandlers({ completeActive })}
      />
    );

    // Wait for completion
    await vi.waitFor(
      () => {
        expect(completeActive).toHaveBeenCalled();
      },
      { timeout: 500 }
    );

    // Should have called withMinimumTime (mocked to return immediately in tests)
    expect(withMinimumTime).toHaveBeenCalled();
  });
});
