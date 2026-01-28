import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  ComponentStatus,
  LearnPhase,
  LearnState,
} from '../../../src/types/components.js';

import { Learn } from '../../../src/components/controllers/Learn.js';
import { LearnView } from '../../../src/components/views/Learn.js';

import {
  Keys,
  createRequestHandlers,
  createLifecycleHandlers,
  createWorkflowHandlers,
} from '../../test-utils.js';

// Mock skills service to avoid filesystem operations
vi.mock('../../../src/services/skills.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/services/skills.js')>();
  return {
    ...actual,
    getAvailableSkillNames: vi.fn().mockReturnValue(['Build App', 'Deploy']),
    isSkillNameAvailable: vi.fn().mockImplementation((name: string) => {
      if (name === 'schedule') {
        return {
          available: false,
          reason: 'Name conflicts with a built-in skill',
        };
      }
      if (name === 'existing') {
        return {
          available: false,
          reason: 'A skill with this name already exists',
        };
      }
      if (!name.trim()) {
        return { available: false, reason: 'Skill name is required' };
      }
      return { available: true };
    }),
    saveSkill: vi.fn(),
    generateSkillMarkdown: vi.fn().mockReturnValue('# Generated markdown'),
  };
});

function renderLearn(props: Partial<React.ComponentProps<typeof Learn>> = {}) {
  return render(
    <Learn
      status={ComponentStatus.Active}
      requestHandlers={createRequestHandlers()}
      lifecycleHandlers={createLifecycleHandlers()}
      workflowHandlers={createWorkflowHandlers()}
      {...props}
    />
  );
}

function createState(overrides: Partial<LearnState> = {}): LearnState {
  return {
    name: null,
    description: null,
    aliases: [],
    configEntries: [],
    stepPairs: [],
    currentPhase: LearnPhase.Name,
    inputValue: '',
    selectedIndex: 0,
    error: null,
    availableSkills: [],
    pendingStepDescription: null,
    pendingExecutionType: null,
    ...overrides,
  };
}

describe('Learn controller', () => {
  describe('Rendering', () => {
    it('renders name input on initial phase', () => {
      const { lastFrame } = renderLearn();
      const output = lastFrame();
      expect(output).toContain('Creating a new skill');
      expect(output).toContain('Name');
    });

    it('pre-fills suggested name when provided', () => {
      const { lastFrame } = renderLearn({
        suggestedName: 'My Skill',
      });
      const output = lastFrame();
      expect(output).toContain('My Skill');
    });
  });

  describe('Abort handling', () => {
    it('calls onAborted when Escape pressed', () => {
      const requestHandlers = createRequestHandlers();
      const onAborted = vi.fn();
      const { stdin } = renderLearn({
        requestHandlers,
        onAborted,
      });

      stdin.write(Keys.Escape);

      expect(onAborted).toHaveBeenCalledWith('skill creation');
      expect(requestHandlers.onCompleted).toHaveBeenCalled();
    });

    it('uses default feedback when onAborted not provided', () => {
      const lifecycleHandlers = createLifecycleHandlers();
      const { stdin } = renderLearn({ lifecycleHandlers });

      stdin.write(Keys.Escape);

      expect(lifecycleHandlers.completeActive).toHaveBeenCalled();
    });
  });

  describe('Inactive state', () => {
    it('does not respond to Escape when not active', () => {
      const requestHandlers = createRequestHandlers();
      const { stdin } = renderLearn({
        status: ComponentStatus.Done,
        requestHandlers,
      });

      stdin.write(Keys.Escape);

      expect(requestHandlers.onCompleted).not.toHaveBeenCalled();
    });
  });
});

describe('Learn view', () => {
  describe('Name phase', () => {
    it('renders name input prompt', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState()}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Creating a new skill');
      expect(output).toContain('Name');
    });

    it('shows validation error', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({ error: 'Skill name is required' })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      expect(lastFrame()).toContain('Skill name is required');
    });
  });

  describe('Description phase', () => {
    it('renders description input with completed name', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy App',
            currentPhase: LearnPhase.Description,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Deploy App');
      expect(output).toContain('Description');
      expect(output).toContain('20 characters');
    });

    it('shows validation error for short description', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Test',
            currentPhase: LearnPhase.Description,
            error: 'Description must be at least 20 characters',
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      expect(lastFrame()).toContain('20 characters');
    });
  });

  describe('Aliases phase', () => {
    it('renders alias input with skip option', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.Aliases,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Alias');
      expect(output).toContain('Enter to skip');
    });

    it('shows existing aliases when adding more', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            aliases: ['deploy it'],
            currentPhase: LearnPhase.Aliases,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('deploy it');
      expect(output).toContain('Another alias');
    });
  });

  describe('Alias more phase', () => {
    it('renders yes/no selection after adding alias', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            aliases: ['deploy it'],
            currentPhase: LearnPhase.AliasMore,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('another alias');
      expect(output).toContain('yes');
      expect(output).toContain('no');
    });
  });

  describe('Config phase', () => {
    it('renders config input with skip option', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.Config,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Config');
      expect(output).toContain('Enter to skip');
    });

    it('shows validation error for invalid config format', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.Config,
            error: 'Format: property.path: string | number | boolean',
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      expect(lastFrame()).toContain('Format');
    });
  });

  describe('Step description phase', () => {
    it('renders step description input for first step', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.StepDescription,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Step 1');
    });
  });

  describe('Step execution type phase', () => {
    it('renders shell command and skill reference options', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.StepExecutionType,
            pendingStepDescription: 'Run deploy script',
            inputValue: 'Run deploy script',
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('shell command');
      expect(output).toContain('reference existing skill');
      expect(output).toContain('Run deploy script');
    });
  });

  describe('Step execution value phase', () => {
    it('renders command input for shell command type', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.StepExecutionValue,
            pendingStepDescription: 'Run deploy',
            pendingExecutionType: 'command',
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('shell command');
    });

    it('renders skill list for reference type', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.StepExecutionValue,
            pendingStepDescription: 'Build first',
            pendingExecutionType: 'reference',
            availableSkills: ['Build App', 'Test Suite'],
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Build App');
      expect(output).toContain('Test Suite');
    });

    it('shows no skills message when none available', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            currentPhase: LearnPhase.StepExecutionValue,
            pendingStepDescription: 'Build first',
            pendingExecutionType: 'reference',
            availableSkills: [],
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      expect(lastFrame()).toContain('no skills available');
    });
  });

  describe('Step more phase', () => {
    it('renders add-more prompt after completing a step', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy',
            description: 'Deploy the application',
            stepPairs: [
              {
                description: 'Install',
                executionType: 'command',
                execution: 'npm install',
              },
            ],
            currentPhase: LearnPhase.StepMore,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('another step');
      expect(output).toContain('yes');
      expect(output).toContain('no');
    });
  });

  describe('Review phase', () => {
    it('renders skill preview with all sections', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Deploy App',
            description: 'Deploy the application to server',
            aliases: ['deploy it'],
            configEntries: ['server.url: string'],
            stepPairs: [
              {
                description: 'Upload files',
                executionType: 'command',
                execution: 'rsync dist/ server:/',
              },
              {
                description: 'Restart service',
                executionType: 'reference',
                execution: 'Restart Server',
              },
            ],
            currentPhase: LearnPhase.Review,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Review');
      expect(output).toContain('Deploy App');
      expect(output).toContain('Deploy the application to server');
      expect(output).toContain('deploy it');
      expect(output).toContain('url: string');
      expect(output).toContain('Upload files');
      expect(output).toContain('Restart service');
      expect(output).toContain('Save this skill');
      expect(output).toContain('yes');
      expect(output).toContain('no');
    });

    it('renders preview without optional sections', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Simple',
            description: 'A minimal skill example',
            stepPairs: [
              {
                description: 'Run it',
                executionType: 'command',
                execution: 'echo hello',
              },
            ],
            currentPhase: LearnPhase.Review,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Simple');
      expect(output).toContain('Run it');
      expect(output).not.toContain('Aliases');
      expect(output).not.toContain('Config');
    });
  });

  describe('Wizard header', () => {
    it('shows completed phases in header during config', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Test Skill',
            description: 'A test skill for validation',
            aliases: ['test it'],
            currentPhase: LearnPhase.Config,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Test Skill');
      expect(output).toContain('A test skill for validation');
      expect(output).toContain('test it');
    });

    it('shows completed steps during step creation', () => {
      const { lastFrame } = render(
        <LearnView
          state={createState({
            name: 'Pipeline',
            description: 'Run the full pipeline process',
            stepPairs: [
              {
                description: 'Build',
                executionType: 'command',
                execution: 'npm run build',
              },
            ],
            currentPhase: LearnPhase.StepDescription,
          })}
          status={ComponentStatus.Active}
          onInputChange={() => {}}
          onInputSubmit={() => {}}
        />
      );
      const output = lastFrame();
      expect(output).toContain('Step 1: Build');
    });
  });
});
