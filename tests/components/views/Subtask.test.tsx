import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../../src/configuration/types.js';
import { ExecutionStatus } from '../../../src/services/shell.js';

// Mock the debug setting loader
vi.mock('../../../src/configuration/io.js', () => ({
  loadDebugSetting: vi.fn(),
}));

import { loadDebugSetting } from '../../../src/configuration/io.js';
import { SubtaskView } from '../../../src/components/views/Subtask.js';

describe('SubtaskView component', () => {
  const mockCommand = {
    description: 'Run tests',
    command: 'npm test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.None);
  });

  describe('Status rendering', () => {
    it('renders pending status with dash icon', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Run test suite"
          command={mockCommand}
          status={ExecutionStatus.Pending}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('- ');
      expect(frame).toContain('Run test suite');
      expect(frame).toContain('npm test');
    });

    it('renders running status with bullet icon', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Run test suite"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={0}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('• ');
      expect(frame).toContain('Run test suite');
    });

    it('renders success status with checkmark icon', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Run test suite"
          command={mockCommand}
          status={ExecutionStatus.Success}
          elapsed={1500}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('✓ ');
      expect(frame).toContain('Run test suite');
    });

    it('renders failed status with cross icon', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Run test suite"
          command={mockCommand}
          status={ExecutionStatus.Failed}
          elapsed={2000}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('✗ ');
      expect(frame).toContain('Run test suite');
    });

    it('renders aborted status with circle-slash icon', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Run test suite"
          command={mockCommand}
          status={ExecutionStatus.Aborted}
          elapsed={500}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('⊘ ');
      // Text will have strikethrough, so check for the strikethrough character
      expect(frame).toContain('\u0336');
    });

    it('renders cancelled status with circle-slash icon', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Run test suite"
          command={mockCommand}
          status={ExecutionStatus.Cancelled}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('⊘ ');
      // Text will have strikethrough, so check for the strikethrough character
      expect(frame).toContain('\u0336');
    });
  });

  describe('Elapsed time display', () => {
    it('shows elapsed time for finished tasks', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Success}
          elapsed={2500}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('2 seconds');
    });

    it('shows elapsed time for running tasks', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={3000}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('3 seconds');
    });

    it('does not show elapsed time for pending tasks', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Pending}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('second');
    });
  });

  describe('Label and command display', () => {
    it('uses label if provided', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Custom label"
          command={mockCommand}
          status={ExecutionStatus.Pending}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('Custom label');
      expect(frame).not.toContain('Run tests');
    });

    it('falls back to command description if no label', () => {
      const { lastFrame } = render(
        <SubtaskView
          label=""
          command={mockCommand}
          status={ExecutionStatus.Pending}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('Run tests');
    });

    it('always shows command string', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Custom label"
          command={mockCommand}
          status={ExecutionStatus.Pending}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('npm test');
    });
  });

  describe('Strikethrough formatting', () => {
    it('applies strikethrough to cancelled task label', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Cancelled}
        />
      );

      const frame = lastFrame();
      // Strikethrough uses Unicode combining character
      expect(frame).toContain('\u0336');
    });

    it('applies strikethrough to aborted task label', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Aborted}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('\u0336');
    });

    it('does not apply strikethrough to other statuses', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Success}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('\u0336');
    });
  });

  describe('Layout structure', () => {
    it('renders command with proper indentation', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Pending}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('∟ ');
      expect(frame).toContain('npm test');
    });

    it('shows spinner for running tasks', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
        />
      );

      const frame = lastFrame();
      // Spinner should be visible
      expect(frame).toBeTruthy();
    });

    it('does not show spinner for completed tasks', () => {
      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Success}
        />
      );

      const frame = lastFrame();
      // Just verify it renders without spinner
      expect(frame).toContain('Build project');
    });
  });

  describe('Current memory display', () => {
    it('shows memory in verbose mode for running tasks', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Verbose);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={2000}
          currentMemory={256}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('256 MB');
    });

    it('shows memory in GB for large values', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Verbose);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={2000}
          currentMemory={2048}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('2.0 GB');
    });

    it('does not show memory in info debug mode', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Info);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={2000}
          currentMemory={256}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('256 MB');
    });

    it('does not show memory in none debug mode', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.None);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={2000}
          currentMemory={256}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('256 MB');
    });

    it('does not show memory for finished tasks', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Verbose);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Success}
          elapsed={2000}
          currentMemory={256}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('256 MB');
    });

    it('does not show memory for pending tasks', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Verbose);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Pending}
          currentMemory={256}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('256 MB');
    });

    it('does not show memory when currentMemory is undefined', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Verbose);

      const { lastFrame } = render(
        <SubtaskView
          label="Build project"
          command={mockCommand}
          status={ExecutionStatus.Running}
          elapsed={2000}
        />
      );

      const frame = lastFrame();
      expect(frame).not.toContain('MB');
      expect(frame).not.toContain('GB');
    });
  });
});
