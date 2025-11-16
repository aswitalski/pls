import { render } from 'ink-testing-library';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AnswerDisplay } from '../../src/ui/AnswerDisplay.js';

describe('AnswerDisplay component', () => {
  it('displays single-line answer with indentation', () => {
    const answer = 'The capital of France is Paris.';

    const { lastFrame } = render(<AnswerDisplay answer={answer} />);

    expect(lastFrame()).toContain('The capital of France is Paris.');
    // Check for indentation (2 spaces)
    expect(lastFrame()).toMatch(/^\s{2}/);
  });

  it('displays multi-line answer with indentation', () => {
    const answer = `The 55 inch Samsung The Frame TV costs around $1,500.
It features a QLED display with 4K resolution.
The Frame includes customizable bezels and Art Mode.
Available at major retailers like Best Buy and Amazon.`;

    const { lastFrame } = render(<AnswerDisplay answer={answer} />);

    const frame = lastFrame();
    expect(frame).toBeDefined();

    // Check all lines are present
    expect(frame).toContain('costs around $1,500');
    expect(frame).toContain('QLED display');
    expect(frame).toContain('customizable bezels');
    expect(frame).toContain('Best Buy and Amazon');

    // Check indentation
    const lines = frame!.split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        expect(line).toMatch(/^\s{2}/);
      }
    });
  });

  it('handles empty answer', () => {
    const { lastFrame } = render(<AnswerDisplay answer="" />);

    expect(lastFrame()).toBe('');
  });

  it('preserves line breaks in answer', () => {
    const answer = `Line 1\nLine 2\nLine 3`;

    const { lastFrame } = render(<AnswerDisplay answer={answer} />);

    const frame = lastFrame();
    expect(frame).toBeDefined();
    const lines = frame!.split('\n').filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(3);
  });

  it('displays technical answer with proper formatting', () => {
    const answer = `TypeScript adds static typing to JavaScript.
It compiles to JavaScript and runs anywhere.
Helps catch errors during development.
Improves code maintainability and tooling.`;

    const { lastFrame } = render(<AnswerDisplay answer={answer} />);

    expect(lastFrame()).toContain('TypeScript adds static typing');
    expect(lastFrame()).toContain('compiles to JavaScript');
    expect(lastFrame()).toContain('catch errors');
    expect(lastFrame()).toContain('maintainability');
  });

  it('displays price information correctly', () => {
    const answer = `Apple stock (AAPL) is currently trading at $178.50.
The stock is up 2.3% from yesterday's close.
Market cap is approximately $2.8 trillion.
Trading volume is above average today.`;

    const { lastFrame } = render(<AnswerDisplay answer={answer} />);

    expect(lastFrame()).toContain('$178.50');
    expect(lastFrame()).toContain('2.3%');
    expect(lastFrame()).toContain('$2.8 trillion');
  });
});
