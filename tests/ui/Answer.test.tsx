import { render } from 'ink-testing-library';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Answer } from '../../src/ui/Answer.js';

import { createMockAnthropicService } from '../test-utils.js';

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
        onComplete={vi.fn()}
        onError={vi.fn()}
        onAborted={vi.fn()}
      />
    );

    expect(lastFrame()).toContain('Finding answer.');
  });

  it('returns null when done', () => {
    const service = createMockAnthropicService({
      answer: 'The 55 inch Samsung The Frame costs around $1,500.',
    });

    const { lastFrame } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        state={{ done: true }}
        service={service}
        onComplete={vi.fn()}
        onError={vi.fn()}
        onAborted={vi.fn()}
      />
    );

    expect(lastFrame()).toBe('');
  });

  it('calls onComplete with answer when successful', async () => {
    const answer = 'The 55 inch Samsung The Frame costs around $1,500.';
    const service = createMockAnthropicService({ answer });
    const onComplete = vi.fn();

    render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        onComplete={onComplete}
        onError={vi.fn()}
        onAborted={vi.fn()}
      />
    );

    // Wait for async processing (minimum 1000ms processing time)
    await vi.waitFor(
      () => {
        expect(onComplete).toHaveBeenCalledWith(answer);
      },
      { timeout: 2000 }
    );
  });

  it('calls onError when service fails', async () => {
    const errorMessage = 'Network error';
    const service = createMockAnthropicService({}, new Error(errorMessage));
    const onError = vi.fn();

    render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        onComplete={vi.fn()}
        onError={onError}
        onAborted={vi.fn()}
      />
    );

    // Wait for async processing (minimum 1000ms processing time)
    await vi.waitFor(
      () => {
        expect(onError).toHaveBeenCalledWith(errorMessage);
      },
      { timeout: 2000 }
    );
  });

  it('shows error message when no service available', async () => {
    const { lastFrame } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={undefined}
        onComplete={vi.fn()}
        onError={vi.fn()}
        onAborted={vi.fn()}
      />
    );

    // Wait for useEffect to set error state
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Error: No service available');
    });
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
        onComplete={vi.fn()}
        onError={vi.fn()}
        onAborted={onAborted}
      />
    );

    stdin.write('\x1b'); // Escape key

    expect(onAborted).toHaveBeenCalled();
  });

  it('respects minimum processing time', async () => {
    const answer = 'Quick answer';
    const service = createMockAnthropicService({ answer });
    const onComplete = vi.fn();

    const startTime = Date.now();

    render(
      <Answer
        question="Quick question?"
        service={service}
        onComplete={onComplete}
        onError={vi.fn()}
        onAborted={vi.fn()}
      />
    );

    // Wait for completion
    await vi.waitFor(
      () => {
        expect(onComplete).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    const elapsed = Date.now() - startTime;
    // Should take at least 1000ms (MIN_PROCESSING_TIME)
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });
});
