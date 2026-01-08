import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ComponentStatus } from '../../../src/types/components.js';

import { Refinement } from '../../../src/components/controllers/Refinement.js';

import { Keys, createRequestHandlers } from '../../test-utils.js';

describe('Refinement', () => {
  const mockOnAborted = vi.fn();

  it('renders message with spinner when not done', () => {
    const { lastFrame } = render(
      <Refinement
        text="Processing your request"
        onAborted={mockOnAborted}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers()}
      />
    );

    const output = lastFrame();
    expect(output).toContain('Processing your request');
    expect(output).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/); // Spinner characters
  });

  it('renders message without spinner when done', () => {
    const { lastFrame } = render(
      <Refinement
        text="Processing complete"
        status={ComponentStatus.Done}
        onAborted={mockOnAborted}
        requestHandlers={createRequestHandlers()}
      />
    );

    const output = lastFrame();
    expect(output).toContain('Processing complete');
    expect(output).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/); // No spinner
  });

  it('defaults to not done when state is undefined', () => {
    const { lastFrame } = render(
      <Refinement
        text="Loading"
        onAborted={mockOnAborted}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers()}
      />
    );

    const output = lastFrame();
    expect(output).toContain('Loading');
    expect(output).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/); // Shows spinner
  });

  it('calls onAborted when Escape key is pressed and not done', () => {
    const onAborted = vi.fn();
    const { stdin } = render(
      <Refinement
        text="Processing"
        onAborted={onAborted}
        status={ComponentStatus.Active}
        requestHandlers={createRequestHandlers()}
      />
    );

    stdin.write(Keys.Escape);

    expect(onAborted).toHaveBeenCalledTimes(1);
  });

  it('does not call onAborted when Escape key is pressed and done', () => {
    const onAborted = vi.fn();
    const { stdin } = render(
      <Refinement
        text="Processing"
        status={ComponentStatus.Done}
        onAborted={onAborted}
        requestHandlers={createRequestHandlers()}
      />
    );

    stdin.write(Keys.Escape);

    expect(onAborted).not.toHaveBeenCalled();
  });
});
