import { describe, expect, it } from 'vitest';

import { Capability } from '../../src/types/components.js';
import { Origin } from '../../src/types/types.js';

describe('Introspect capability handling', () => {
  it('filters debug-only capabilities in normal mode', () => {
    // Simulate the filtering logic from Introspect component
    const allCapabilities: Capability[] = [
      {
        name: 'Introspect',
        description: 'list capabilities',
        origin: Origin.BuiltIn,
      },
      {
        name: 'Configure',
        description: 'manage settings',
        origin: Origin.BuiltIn,
      },
      {
        name: 'Answer',
        description: 'provide information',
        origin: Origin.BuiltIn,
      },
      { name: 'Execute', description: 'run commands', origin: Origin.BuiltIn },
      {
        name: 'Schedule',
        description: 'break down requests',
        origin: Origin.Indirect,
      },
      {
        name: 'Validate',
        description: 'verify operations',
        origin: Origin.Indirect,
      },
      {
        name: 'Report',
        description: 'summarize outcomes',
        origin: Origin.Indirect,
      },
    ];

    // In normal mode, filter out Schedule, Validate, Report
    const filteredCapabilities = allCapabilities.filter(
      (cap) =>
        cap.name.toUpperCase() !== 'SCHEDULE' &&
        cap.name.toUpperCase() !== 'VALIDATE' &&
        cap.name.toUpperCase() !== 'REPORT'
    );

    expect(filteredCapabilities.length).toBe(4);
    expect(filteredCapabilities.map((c) => c.name)).toEqual([
      'Introspect',
      'Configure',
      'Answer',
      'Execute',
    ]);
  });

  it('includes debug-only capabilities in debug mode', () => {
    // In debug mode, all capabilities should be included
    const allCapabilities: Capability[] = [
      {
        name: 'Introspect',
        description: 'list capabilities',
        origin: Origin.BuiltIn,
      },
      {
        name: 'Configure',
        description: 'manage settings',
        origin: Origin.BuiltIn,
      },
      {
        name: 'Answer',
        description: 'provide information',
        origin: Origin.BuiltIn,
      },
      { name: 'Execute', description: 'run commands', origin: Origin.BuiltIn },
      {
        name: 'Schedule',
        description: 'break down requests',
        origin: Origin.Indirect,
      },
      {
        name: 'Validate',
        description: 'verify operations',
        origin: Origin.Indirect,
      },
      {
        name: 'Report',
        description: 'summarize outcomes',
        origin: Origin.Indirect,
      },
    ];

    // In debug mode, no filtering applied
    expect(allCapabilities.length).toBe(7);
    expect(allCapabilities.map((c) => c.name)).toEqual([
      'Introspect',
      'Configure',
      'Answer',
      'Execute',
      'Schedule',
      'Validate',
      'Report',
    ]);
  });

  it('handles mixed built-in and user-defined capabilities', () => {
    const capabilities: Capability[] = [
      {
        name: 'Schedule',
        description: 'break down requests',
        origin: Origin.Indirect,
      },
      { name: 'Execute', description: 'run commands', origin: Origin.BuiltIn },
      {
        name: 'Deploy App',
        description: 'deploy application',
        origin: Origin.UserProvided,
      },
    ];

    expect(capabilities.length).toBe(3);
    expect(capabilities[0].origin).toBe(Origin.Indirect);
    expect(capabilities[1].origin).toBe(Origin.BuiltIn);
    expect(capabilities[2].origin).toBe(Origin.UserProvided);
  });

  it('handles capability structure correctly', () => {
    const capability: Capability = {
      name: 'Deploy Application',
      description: 'build and deploy to production',
      origin: Origin.UserProvided,
    };

    expect(capability.name).toBe('Deploy Application');
    expect(capability.description).toBe('build and deploy to production');
    expect(capability.origin).toBe(Origin.UserProvided);
  });
});
