import { useEffect, useState } from 'react';

import { ComponentStatus, ConfigProps } from '../../types/components.js';
import { FeedbackType } from '../../types/types.js';

import { createFeedback } from '../../services/components.js';
import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';

import { ConfigState, ConfigView, StepType } from '../views/Config.js';

export {
  ConfigOption,
  ConfigState,
  ConfigStep,
  ConfigView,
  ConfigViewProps,
  StepType,
} from '../views/Config.js';

/**
 * Config controller: Multi-step wizard logic
 */

export function Config<
  T extends Record<string, string> = Record<string, string>,
>(props: ConfigProps<T>) {
  const {
    steps,
    status,
    debug = DebugLevel.None,
    requestHandlers,
    lifecycleHandlers,
    onFinished,
    onAborted,
  } = props;
  const isActive = status === ComponentStatus.Active;

  const [step, setStep] = useState<number>(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    // Initialize from step defaults
    const initial: Record<string, string> = {};
    steps.forEach((stepConfig) => {
      // Use full path if available, otherwise use key
      const configKey = stepConfig.path || stepConfig.key;
      switch (stepConfig.type) {
        case StepType.Text:
          if (stepConfig.value !== null) {
            initial[configKey] = stepConfig.value;
          }
          break;
        case StepType.Selection:
          initial[configKey] =
            stepConfig.options[stepConfig.defaultIndex].value;
          break;
        default: {
          const _exhaustiveCheck: never = stepConfig;
          throw new Error('Unsupported step type');
        }
      }
    });
    return initial;
  });
  const [inputValue, setInputValue] = useState(() => {
    // Initialize with the current step's value if available
    if (step < steps.length) {
      const stepConfig = steps[step];
      const configKey = stepConfig.path || stepConfig.key;
      return values[configKey] || '';
    }
    return '';
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const normalizeValue = (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return '';
    }
    return value.replace(/\n/g, '').trim();
  };

  // Update inputValue when step changes
  useEffect(() => {
    if (isActive && step < steps.length) {
      const stepConfig = steps[step];
      const configKey = stepConfig.path || stepConfig.key;
      const value = values[configKey] || '';
      setInputValue(value);
    }
  }, [step, isActive, steps]);

  useInput(
    (_, key) => {
      if (!isActive || step >= steps.length) return;

      const currentStepConfig = steps[step];

      if (key.escape) {
        // Save current value before aborting
        const configKey = currentStepConfig.path || currentStepConfig.key;
        let currentValue = '';
        switch (currentStepConfig.type) {
          case StepType.Text:
            currentValue = inputValue || values[configKey] || '';
            break;
          case StepType.Selection:
            currentValue = values[configKey] || '';
            break;
          default: {
            const _exhaustiveCheck: never = currentStepConfig;
            throw new Error('Unsupported step type');
          }
        }
        const finalValues = currentValue
          ? { ...values, [configKey]: currentValue }
          : values;

        // Expose final state
        const finalState: ConfigState = {
          values: finalValues,
          completedStep: step,
          selectedIndex,
        };
        requestHandlers.onCompleted(finalState);

        // Abort configuration
        if (onAborted) {
          // Let Workflow handler complete and add feedback
          onAborted('configuration');
        } else {
          // Fallback: complete with abort feedback directly
          lifecycleHandlers.completeActive(
            createFeedback({
              type: FeedbackType.Aborted,
              message: 'Configuration cancelled.',
            })
          );
        }
        return;
      }

      // Handle selection step navigation
      if (currentStepConfig.type === StepType.Selection) {
        if (key.tab) {
          setSelectedIndex(
            (prev) => (prev + 1) % currentStepConfig.options.length
          );
        } else if (key.return) {
          handleSubmit(currentStepConfig.options[selectedIndex].value);
        }
      }
    },
    { isActive }
  );

  const handleSubmit = (value: string) => {
    const currentStepConfig = steps[step];

    let finalValue = '';

    switch (currentStepConfig.type) {
      case StepType.Selection:
        // For selection, value is already validated by options
        finalValue = value;
        break;
      case StepType.Text: {
        // For text input
        const normalizedInput = normalizeValue(value);

        // Try user input first, then fall back to default
        if (normalizedInput && currentStepConfig.validate(normalizedInput)) {
          finalValue = normalizedInput;
        } else if (
          currentStepConfig.value &&
          currentStepConfig.validate(currentStepConfig.value)
        ) {
          finalValue = currentStepConfig.value;
        }
        break;
      }
      default: {
        const _exhaustiveCheck: never = currentStepConfig;
        throw new Error('Unsupported step type');
      }
    }

    // Don't allow empty or invalid value
    if (!finalValue) {
      return;
    }

    // Use full path if available, otherwise use key
    const configKey = currentStepConfig.path || currentStepConfig.key;
    const newValues = { ...values, [configKey]: finalValue };
    setValues(newValues);
    setInputValue('');

    if (step === steps.length - 1) {
      // Last step completed

      // Expose final state
      const finalState: ConfigState = {
        values: newValues,
        completedStep: steps.length,
        selectedIndex,
      };
      requestHandlers.onCompleted(finalState);

      // Call onFinished callback and handle result
      try {
        if (onFinished) {
          onFinished(newValues as T);
        }

        // Success - complete with success feedback
        lifecycleHandlers.completeActive(
          createFeedback({
            type: FeedbackType.Succeeded,
            message: 'Configuration saved successfully.',
          })
        );
      } catch (error) {
        // Failure - complete with error feedback
        const errorMessage =
          error instanceof Error ? error.message : 'Configuration failed';
        lifecycleHandlers.completeActive(
          createFeedback({ type: FeedbackType.Failed, message: errorMessage })
        );
      }

      setStep(steps.length);
    } else {
      const nextStep = step + 1;
      setStep(nextStep);

      // Reset selectedIndex for next step
      if (
        nextStep < steps.length &&
        steps[nextStep].type === StepType.Selection
      ) {
        setSelectedIndex(steps[nextStep].defaultIndex);
      }
    }
  };

  // Build current state for View
  // Controller always renders View, passing current state and callbacks
  const state: ConfigState = {
    values,
    completedStep: step,
    selectedIndex,
  };

  return (
    <ConfigView
      steps={steps}
      state={state}
      status={status}
      debug={debug}
      onInputChange={setInputValue}
      onInputSubmit={handleSubmit}
    />
  );
}
