import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Refinement } from '../src/ui/Refinement.js';
import { Keys } from './test-utils.js';

describe('Refinement', () => {
  const mockOnAborted = vi.fn();

  it('renders message with spinner when not done', () => {
    const { lastFrame } = render(
      <Refinement
        text="Processing your request"
        state={{ done: false }}
        onAborted={mockOnAborted}
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
        state={{ done: true }}
        onAborted={mockOnAborted}
      />
    );

    const output = lastFrame();
    expect(output).toContain('Processing complete');
    expect(output).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/); // No spinner
  });

  it('defaults to not done when state is undefined', () => {
    const { lastFrame } = render(
      <Refinement text="Loading" onAborted={mockOnAborted} />
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
        state={{ done: false }}
        onAborted={onAborted}
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
        state={{ done: true }}
        onAborted={onAborted}
      />
    );

    stdin.write(Keys.Escape);

    expect(onAborted).not.toHaveBeenCalled();
  });
});
