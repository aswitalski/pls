import { useEffect, useState } from 'react';

import {
  ComponentStatus,
  LearnPhase,
  LearnProps,
  LearnState,
  LearnStepPair,
} from '../../types/components.js';
import { FeedbackType } from '../../types/types.js';

import { createFeedback } from '../../services/components.js';
import { useInput } from '../../services/keyboard.js';
import {
  generateSkillMarkdown,
  getAvailableSkillNames,
  isSkillNameAvailable,
  saveSkill,
} from '../../services/skills.js';
import { displayNameToKey } from '../../services/parser.js';

import { LearnView } from '../views/Learn.js';

export { LearnView } from '../views/Learn.js';

/**
 * Learn controller: Guided walkthrough for skill creation
 */
export function Learn(props: LearnProps) {
  const {
    status,
    requestHandlers,
    lifecycleHandlers,
    onFinished,
    onAborted,
    suggestedName,
  } = props;
  const isActive = status === ComponentStatus.Active;

  const [state, setState] = useState<LearnState>(() => ({
    name: null,
    description: null,
    aliases: [],
    configEntries: [],
    stepPairs: [],
    currentPhase: LearnPhase.Name,
    inputValue: suggestedName || '',
    selectedIndex: 0,
    error: null,
    availableSkills: [],
    pendingStepDescription: null,
    pendingExecutionType: null,
  }));

  // Load available skills on mount
  useEffect(() => {
    if (isActive) {
      const skills = getAvailableSkillNames();
      setState((prev) => ({ ...prev, availableSkills: skills }));
    }
  }, [isActive]);

  const handleInputChange = (value: string) => {
    setState((prev) => ({ ...prev, inputValue: value, error: null }));
  };

  const handleNameSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setState((prev) => ({ ...prev, error: 'Skill name is required' }));
      return;
    }

    const availability = isSkillNameAvailable(trimmed);
    if (!availability.available) {
      setState((prev) => ({
        ...prev,
        error: availability.reason || 'Invalid name',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      name: trimmed,
      inputValue: '',
      error: null,
      currentPhase: LearnPhase.Description,
    }));
  };

  const handleDescriptionSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 20) {
      setState((prev) => ({
        ...prev,
        error: 'Description must be at least 20 characters',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      description: trimmed,
      inputValue: '',
      error: null,
      currentPhase: LearnPhase.Aliases,
    }));
  };

  const handleAliasSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      // Skip to config phase
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.Config,
      }));
      return;
    }

    // Add alias and ask for more
    setState((prev) => ({
      ...prev,
      aliases: [...prev.aliases, trimmed],
      inputValue: '',
      selectedIndex: 0,
      currentPhase: LearnPhase.AliasMore,
    }));
  };

  const handleAliasMoreSelection = (addMore: boolean) => {
    if (addMore) {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.Aliases,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.Config,
      }));
    }
  };

  const validateConfigEntry = (entry: string): boolean => {
    const configPattern =
      /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*:\s*(string|number|boolean)$/;
    return configPattern.test(entry.trim());
  };

  const handleConfigSubmit = (value: string) => {
    const trimmed = value.trim();

    // Empty is allowed (skip config)
    if (!trimmed) {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.StepDescription,
      }));
      return;
    }

    // Validate entry
    if (!validateConfigEntry(trimmed)) {
      setState((prev) => ({
        ...prev,
        error: 'Format: property.path: string | number | boolean',
      }));
      return;
    }

    // Add config entry and ask for more
    setState((prev) => ({
      ...prev,
      configEntries: [...prev.configEntries, trimmed],
      inputValue: '',
      selectedIndex: 0,
      error: null,
      currentPhase: LearnPhase.ConfigMore,
    }));
  };

  const handleConfigMoreSelection = (addMore: boolean) => {
    if (addMore) {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.Config,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.StepDescription,
      }));
    }
  };

  const handleStepDescriptionSubmit = (value: string) => {
    const trimmed = value.trim();
    // For first step, use skill name as default if empty
    const description =
      trimmed || (state.stepPairs.length === 0 ? state.name : null);
    if (!description) {
      setState((prev) => ({
        ...prev,
        error: 'Step description is required',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      pendingStepDescription: description,
      inputValue: description, // Keep for display in next phase
      selectedIndex: 0,
      error: null,
      currentPhase: LearnPhase.StepExecutionType,
    }));
  };

  const handleExecutionTypeSelection = (type: 'command' | 'reference') => {
    setState((prev) => ({
      ...prev,
      pendingExecutionType: type,
      inputValue: '',
      selectedIndex: 0,
      currentPhase: LearnPhase.StepExecutionValue,
    }));
  };

  const handleExecutionValueSubmit = (value: string) => {
    if (!state.pendingStepDescription || !state.pendingExecutionType) return;

    const trimmed = value.trim();
    if (!trimmed) {
      setState((prev) => ({
        ...prev,
        error:
          state.pendingExecutionType === 'command'
            ? 'Command is required'
            : 'Skill selection is required',
      }));
      return;
    }

    const newPair: LearnStepPair = {
      description: state.pendingStepDescription,
      executionType: state.pendingExecutionType,
      execution: trimmed,
    };

    setState((prev) => ({
      ...prev,
      stepPairs: [...prev.stepPairs, newPair],
      pendingStepDescription: null,
      pendingExecutionType: null,
      inputValue: '',
      selectedIndex: 0,
      error: null,
      currentPhase: LearnPhase.StepMore,
    }));
  };

  const handleSkillReferenceSelection = (skillName: string) => {
    if (!state.pendingStepDescription) return;

    const newPair: LearnStepPair = {
      description: state.pendingStepDescription,
      executionType: 'reference',
      execution: skillName,
    };

    setState((prev) => ({
      ...prev,
      stepPairs: [...prev.stepPairs, newPair],
      pendingStepDescription: null,
      pendingExecutionType: null,
      inputValue: '',
      selectedIndex: 0,
      error: null,
      currentPhase: LearnPhase.StepMore,
    }));
  };

  const handleStepMoreSelection = (addMore: boolean) => {
    if (addMore) {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        currentPhase: LearnPhase.StepDescription,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        inputValue: '',
        selectedIndex: 0,
        currentPhase: LearnPhase.Review,
      }));
    }
  };

  const handleReviewSelection = (save: boolean) => {
    if (save && state.name && state.description) {
      try {
        const markdown = generateSkillMarkdown(
          state.name,
          state.description,
          state.aliases,
          state.configEntries,
          state.stepPairs
        );
        const key = displayNameToKey(state.name);
        saveSkill(key, markdown);

        requestHandlers.onCompleted(state);
        onFinished?.(key);
        lifecycleHandlers.completeActive(
          createFeedback({
            type: FeedbackType.Info,
            message: `Skill "${state.name}" saved to ~/.pls/skills/${key}.md`,
          })
        );
      } catch (error) {
        lifecycleHandlers.completeActive(
          createFeedback({
            type: FeedbackType.Failed,
            message:
              error instanceof Error ? error.message : 'Failed to save skill',
          })
        );
      }
    } else {
      handleAbort();
    }
  };

  const handleAbort = () => {
    requestHandlers.onCompleted(state);
    if (onAborted) {
      onAborted('skill creation');
    } else {
      lifecycleHandlers.completeActive(
        createFeedback({
          type: FeedbackType.Aborted,
          message: 'Skill creation cancelled.',
        })
      );
    }
  };

  const handleInputSubmit = (value: string) => {
    switch (state.currentPhase) {
      case LearnPhase.Name:
        handleNameSubmit(value);
        break;
      case LearnPhase.Description:
        handleDescriptionSubmit(value);
        break;
      case LearnPhase.Aliases:
        handleAliasSubmit(value);
        break;
      case LearnPhase.Config:
        handleConfigSubmit(value);
        break;
      case LearnPhase.StepDescription:
        handleStepDescriptionSubmit(value);
        break;
      case LearnPhase.StepExecutionValue:
        if (state.pendingExecutionType === 'command') {
          handleExecutionValueSubmit(value);
        }
        break;
    }
  };

  // Keyboard input handling
  useInput(
    (_, key) => {
      if (!isActive) return;

      if (key.escape) {
        handleAbort();
        return;
      }

      // Handle selection phases
      switch (state.currentPhase) {
        case LearnPhase.AliasMore:
          if (key.tab) {
            setState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % 2,
            }));
          } else if (key.return) {
            handleAliasMoreSelection(state.selectedIndex === 0);
          }
          break;

        case LearnPhase.ConfigMore:
          if (key.tab) {
            setState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % 2,
            }));
          } else if (key.return) {
            handleConfigMoreSelection(state.selectedIndex === 0);
          }
          break;

        case LearnPhase.StepMore:
          if (key.tab) {
            setState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % 2,
            }));
          } else if (key.return) {
            handleStepMoreSelection(state.selectedIndex === 0);
          }
          break;

        case LearnPhase.Review:
          if (key.tab) {
            setState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % 2,
            }));
          } else if (key.return) {
            handleReviewSelection(state.selectedIndex === 0);
          }
          break;

        case LearnPhase.StepExecutionType:
          if (key.tab) {
            setState((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % 2,
            }));
          } else if (key.return) {
            const type = state.selectedIndex === 0 ? 'command' : 'reference';
            handleExecutionTypeSelection(type);
          }
          break;

        case LearnPhase.StepExecutionValue:
          if (state.pendingExecutionType === 'reference') {
            const skillCount = state.availableSkills.length;
            if (skillCount === 0) {
              // No skills available, go back to type selection
              if (key.return) {
                setState((prev) => ({
                  ...prev,
                  error: 'No skills available to reference',
                  selectedIndex: 0,
                  currentPhase: LearnPhase.StepExecutionType,
                }));
              }
            } else {
              if (key.tab) {
                setState((prev) => ({
                  ...prev,
                  selectedIndex: (prev.selectedIndex + 1) % skillCount,
                }));
              } else if (key.return) {
                const selectedSkill =
                  state.availableSkills[state.selectedIndex];
                handleSkillReferenceSelection(selectedSkill);
              }
            }
          }
          break;
      }
    },
    { isActive }
  );

  return (
    <LearnView
      state={state}
      status={status}
      onInputChange={handleInputChange}
      onInputSubmit={handleInputSubmit}
    />
  );
}
