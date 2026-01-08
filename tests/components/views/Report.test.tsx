import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { ComponentStatus, Capability } from '../../../src/types/components.js';
import { Origin } from '../../../src/types/types.js';

import { Report } from '../../../src/components/views/Report.js';

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
      <Report
        message="Here are my capabilities:"
        capabilities={capabilities}
        status={ComponentStatus.Done}
      />
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
      <Report
        message="Available:"
        capabilities={capabilities}
        status={ComponentStatus.Done}
      />
    );

    const output = lastFrame();
    expect(output).toContain('- Execute');
    expect(output).toContain('run commands');
  });

  it('handles empty capabilities list', () => {
    const { lastFrame } = render(
      <Report
        message="No capabilities found:"
        capabilities={[]}
        status={ComponentStatus.Done}
      />
    );

    expect(lastFrame()).toContain('No capabilities found:');
  });
});
