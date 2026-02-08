import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { ComponentStatus } from '../../../src/types/components.js';

import { DiscoverView } from '../../../src/components/views/Discover.js';

describe('DiscoverView component', () => {
  describe('Discovering phase', () => {
    it('shows action name', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Active}
          action="Find TypeScript files"
          phase="discovering"
          message={null}
          command={null}
          output={null}
          error={null}
        />
      );

      expect(lastFrame()).toContain('Find TypeScript files');
    });

    it('shows spinner while discovering', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Active}
          action="Find TypeScript files"
          phase="discovering"
          message={null}
          command={null}
          output={null}
          error={null}
        />
      );

      expect(lastFrame()).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });
  });

  describe('Executing phase', () => {
    it('shows command being executed', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Active}
          action="Find TypeScript files"
          phase="executing"
          message="Search for TypeScript files."
          command={{
            description: 'Find .ts files',
            command: "find . -name '*.ts'",
          }}
          output={null}
          error={null}
        />
      );

      const output = lastFrame();
      expect(output).toContain("$ find . -name '*.ts'");
      expect(output).toContain('Search for TypeScript files.');
    });
  });

  describe('Done phase', () => {
    it('shows command and output when done', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Done}
          action="Show disk usage"
          phase="done"
          message="Check disk space."
          command={{
            description: 'Show disk usage',
            command: 'df -h',
          }}
          output="/dev/disk1s1  466Gi  200Gi  250Gi    45%"
          error={null}
        />
      );

      const output = lastFrame();
      expect(output).toContain('$ df -h');
      expect(output).toContain('Check disk space.');
      expect(output).toContain('466Gi');
    });

    it('shows command without output when output is empty', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Done}
          action="Create directory"
          phase="done"
          message="Directory created."
          command={{
            description: 'Create a new directory',
            command: 'mkdir -p new-dir',
          }}
          output=""
          error={null}
        />
      );

      const output = lastFrame();
      expect(output).toContain('$ mkdir -p new-dir');
      expect(output).toContain('Directory created.');
    });
  });

  describe('Error display', () => {
    it('shows error message', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Active}
          action="Find files"
          phase="discovering"
          message={null}
          command={null}
          output={null}
          error="API connection failed"
        />
      );

      expect(lastFrame()).toContain('Error: API connection failed');
    });
  });

  describe('Upcoming tasks', () => {
    it('shows upcoming tasks when active', () => {
      const { lastFrame } = render(
        <DiscoverView
          status={ComponentStatus.Active}
          action="Find TypeScript files"
          phase="discovering"
          message={null}
          command={null}
          output={null}
          error={null}
          upcoming={['Show disk usage', 'List processes']}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Show disk usage');
      expect(output).toContain('List processes');
    });
  });
});
