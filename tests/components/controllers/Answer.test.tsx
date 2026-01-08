import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnswerState, ComponentStatus } from '../../../src/types/components.js';

import {
  Answer,
  AnswerView,
} from '../../../src/components/controllers/Answer.js';

import {
  createRequestHandlers,
  createLifecycleHandlers,
  createMockAnthropicService,
  createMockDebugComponents,
  createWorkflowHandlers,
} from '../../test-utils.js';

// Mock timing helpers to skip delays in tests
vi.mock('../../../src/services/timing.js', () => ({
  ELAPSED_UPDATE_INTERVAL: 250,
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
        requestHandlers={createRequestHandlers<AnswerState>()}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    // Loading state shows question
    expect(lastFrame()).toContain(
      'What is the price of Samsung The Frame 55 inch?'
    );
  });

  it('displays question and answer when done', () => {
    const { lastFrame } = render(
      <AnswerView
        status={ComponentStatus.Done}
        question="What is the price of Samsung The Frame 55 inch?"
        lines={['The 55 inch Samsung The Frame costs around $1,500.']}
        error={null}
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
    const lifecycleHandlers = createLifecycleHandlers({ completeActive });

    const { lastFrame } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers<AnswerState>()}
        lifecycleHandlers={lifecycleHandlers}
        workflowHandlers={createWorkflowHandlers()}
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
    const errorHandlers = createRequestHandlers({ onError });

    render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        status={ComponentStatus.Active}
        lifecycleHandlers={createLifecycleHandlers()}
        requestHandlers={errorHandlers}
        workflowHandlers={createWorkflowHandlers()}
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
    const errorHandlers = createRequestHandlers({ onAborted });

    const { stdin } = render(
      <Answer
        question="What is the price of Samsung The Frame 55 inch?"
        service={service}
        status={ComponentStatus.Active}
        lifecycleHandlers={createLifecycleHandlers()}
        requestHandlers={errorHandlers}
        workflowHandlers={createWorkflowHandlers()}
      />
    );

    stdin.write('\x1b'); // Escape key

    expect(onAborted).toHaveBeenCalledWith('answer');
  });

  it('uses withMinimumTime for UX polish', async () => {
    const { withMinimumTime } = await import('../../../src/services/timing.js');
    const answer = 'Quick answer';
    const service = createMockAnthropicService({ answer });
    const completeActive = vi.fn();
    const lifecycleHandlers = createLifecycleHandlers({ completeActive });

    render(
      <Answer
        question="Quick question?"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers<AnswerState>()}
        lifecycleHandlers={lifecycleHandlers}
        workflowHandlers={createWorkflowHandlers()}
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

    const workflowHandlers = createWorkflowHandlers();

    render(
      <Answer
        question="Test question?"
        service={service}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers<AnswerState>()}
        lifecycleHandlers={createLifecycleHandlers()}
        workflowHandlers={workflowHandlers}
      />
    );

    // Wait for processing
    await vi.waitFor(
      () => {
        expect(workflowHandlers.addToTimeline).toHaveBeenCalledWith(
          ...debugComponents
        );
      },
      { timeout: 500 }
    );
  });

  describe('upcoming tasks display', () => {
    it('shows upcoming tasks when active', () => {
      const { lastFrame } = render(
        <AnswerView
          status={ComponentStatus.Active}
          question="What is TypeScript?"
          lines={null}
          error={null}
          upcoming={['Question 2', 'Question 3']}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Next:');
      expect(output).toContain('Question 2');
      expect(output).toContain('Question 3');
    });

    it('shows current and upcoming tasks as cancelled when aborted', () => {
      const { lastFrame } = render(
        <AnswerView
          status={ComponentStatus.Done}
          question="What is TypeScript?"
          lines={null}
          error={null}
          upcoming={['Question 2', 'Question 3']}
          cancelled={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Cancelled:');
      expect(output).toContain('What is TypeScript?');
      expect(output).toContain('Question 2');
      expect(output).toContain('Question 3');
    });

    it('shows current and upcoming tasks as skipped when error occurs', () => {
      const { lastFrame } = render(
        <AnswerView
          status={ComponentStatus.Done}
          question="What is TypeScript?"
          lines={null}
          error="Network error"
          upcoming={['Question 2', 'Question 3']}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Skipped:');
      expect(output).toContain('What is TypeScript?');
      expect(output).toContain('Question 2');
      expect(output).toContain('Question 3');
    });

    it('does not show upcoming section when active and empty', () => {
      const { lastFrame } = render(
        <AnswerView
          status={ComponentStatus.Active}
          question="What is TypeScript?"
          lines={null}
          error={null}
          upcoming={[]}
        />
      );

      const output = lastFrame();
      expect(output).not.toContain('Next:');
    });

    it('shows current question as cancelled even with no upcoming', () => {
      const { lastFrame } = render(
        <AnswerView
          status={ComponentStatus.Done}
          question="What is TypeScript?"
          lines={null}
          error={null}
          upcoming={[]}
          cancelled={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Cancelled:');
      expect(output).toContain('What is TypeScript?');
    });
  });
});
