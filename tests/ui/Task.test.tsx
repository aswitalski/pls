import React from 'react';
import { render } from 'ink-testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugLevel } from '../../src/configuration/types.js';
import { ExecutionStatus } from '../../src/services/shell.js';

import { TaskView } from '../../src/components/views/Task.js';

// Mock the debug setting loader
vi.mock('../../src/configuration/io.js', () => ({
  loadDebugSetting: vi.fn(),
}));

import { loadDebugSetting } from '../../src/configuration/io.js';

describe('TaskView component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Output visibility', () => {
    const baseProps = {
      label: 'Test task',
      command: { description: 'Run test', command: 'npm test' },
      status: ExecutionStatus.Success,
      elapsed: 100,
      output: { stdout: 'Test output line', stderr: '' },
      isFinished: true,
    };

    it('shows output when execution is active', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.None);

      const { lastFrame } = render(<TaskView {...baseProps} isActive={true} />);

      expect(lastFrame()).toContain('Test output line');
    });

    it('hides output in timeline when debug is none', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.None);

      const { lastFrame } = render(
        <TaskView {...baseProps} isActive={false} />
      );

      expect(lastFrame()).not.toContain('Test output line');
    });

    it('shows output in timeline when debug is info', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Info);

      const { lastFrame } = render(
        <TaskView {...baseProps} isActive={false} />
      );

      expect(lastFrame()).toContain('Test output line');
    });

    it('shows output in timeline when debug is verbose', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.Verbose);

      const { lastFrame } = render(
        <TaskView {...baseProps} isActive={false} />
      );

      expect(lastFrame()).toContain('Test output line');
    });

    it('always shows task label regardless of debug mode', () => {
      vi.mocked(loadDebugSetting).mockReturnValue(DebugLevel.None);

      const { lastFrame } = render(
        <TaskView {...baseProps} isActive={false} />
      );

      expect(lastFrame()).toContain('Test task');
    });
  });
});
