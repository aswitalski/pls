import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { Capability } from '../../src/types/components.js';
import { Origin } from '../../src/types/types.js';

import { Report } from '../../src/ui/Report.js';

describe('Report component', () => {
  it('renders message and capabilities list', () => {
    const capabilities: Capability[] = [
      {
        name: 'Plan',
        description: 'break down requests',
        origin: Origin.Indirect,
      },
      {
        name: 'Deploy App',
        description: 'deploy application',
        origin: Origin.UserProvided,
      },
    ];

    const { lastFrame } = render(
      <Report message="Here are my capabilities:" capabilities={capabilities} />
    );

    expect(lastFrame()).toContain('Here are my capabilities:');
    expect(lastFrame()).toContain('Plan');
    expect(lastFrame()).toContain('Deploy App');
  });

  it('formats capabilities with dash and separator', () => {
    const capabilities: Capability[] = [
      { name: 'Execute', description: 'run commands', origin: Origin.BuiltIn },
    ];

    const { lastFrame } = render(
      <Report message="Available:" capabilities={capabilities} />
    );

    const output = lastFrame();
    expect(output).toContain('- Execute');
    expect(output).toContain('run commands');
  });

  it('handles empty capabilities list', () => {
    const { lastFrame } = render(
      <Report message="No capabilities found:" capabilities={[]} />
    );

    expect(lastFrame()).toContain('No capabilities found:');
  });

  it('displays multiple capabilities correctly', () => {
    const capabilities: Capability[] = [
      {
        name: 'Plan',
        description: 'break down requests',
        origin: Origin.Indirect,
      },
      { name: 'Execute', description: 'run commands', origin: Origin.BuiltIn },
      {
        name: 'Answer',
        description: 'provide information',
        origin: Origin.BuiltIn,
      },
      {
        name: 'Deploy App',
        description: 'deploy to production',
        origin: Origin.UserProvided,
      },
    ];

    const { lastFrame } = render(
      <Report message="Capabilities:" capabilities={capabilities} />
    );

    const output = lastFrame();
    expect(output).toContain('Plan');
    expect(output).toContain('Execute');
    expect(output).toContain('Answer');
    expect(output).toContain('Deploy App');
  });

  it('preserves capability name formatting', () => {
    const capabilities: Capability[] = [
      {
        name: 'Deploy Application',
        description: 'deploy app',
        origin: Origin.UserProvided,
      },
      {
        name: 'Process Data',
        description: 'process files',
        origin: Origin.UserProvided,
      },
    ];

    const { lastFrame } = render(
      <Report message="Skills:" capabilities={capabilities} />
    );

    const output = lastFrame();
    // Names should remain as provided (not converted to CamelCase)
    expect(output).toContain('Deploy Application');
    expect(output).toContain('Process Data');
  });
});
