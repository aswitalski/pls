import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComponentStatus } from '../../src/types/components.js';

import { Answer } from '../../src/ui/Answer.js';

import {
  createMockAnthropicService,
  createMockDebugComponents,
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
        status={ComponentStatus.Active}
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
        service={service}
        status={ComponentStatus.Done}
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
        status={ComponentStatus.Active}
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
        status={ComponentStatus.Active}
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
        status={ComponentStatus.Active}
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
        status={ComponentStatus.Active}
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

  it('adds debug components to timeline', async () => {
    const debugComponents = createMockDebugComponents('answer');

    const service = createMockAnthropicService({
      answer: 'Test answer',
      debug: debugComponents,
    });

    const handlers = createMockHandlers();

    render(
      <Answer
        question="Test question?"
        service={service}
        status={ComponentStatus.Active}
        handlers={handlers}
      />
    );

    // Wait for processing
    await vi.waitFor(
      () => {
        expect(handlers.addToTimeline).toHaveBeenCalledWith(...debugComponents);
      },
      { timeout: 500 }
    );
  });
});
