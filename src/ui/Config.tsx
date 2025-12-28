import { type ReactElement, useEffect, useState } from 'react';
import { Box, Text, useFocus } from 'ink';
import TextInput from 'ink-text-input';

import { ComponentStatus, ConfigProps } from '../types/components.js';
import { FeedbackType } from '../types/types.js';

import { Colors } from '../services/colors.js';
import { createFeedback } from '../services/components.js';
import { DebugLevel } from '../services/configuration.js';
import { useInput } from '../services/keyboard.js';

export interface ConfigState {
  values: Record<string, string>;
  completedStep: number;
  selectedIndex: number;
}

/**
 * Get postfix with debug brackets if debug is enabled
 * Info: {key} | Verbose: {key} entry
 */
function getPostfix(text: string | undefined, debugLevel: DebugLevel): string {
  if (debugLevel === DebugLevel.None || !text) {
    return '';
  }

  if (debugLevel === DebugLevel.Info) {
    return `{${text}}`;
  }

  return `{${text}} entry`;
}

export enum StepType {
  Text = 'text',
  Selection = 'selection',
}

export interface ConfigOption {
  label: string;
  value: string;
}

export type ConfigStep = {
  description: string;
  key: string;
  path?: string;
  validate: (value: string) => boolean;
} & (
  | {
      type: StepType.Text;
      value: string | null;
    }
  | {
      type: StepType.Selection;
      options: ConfigOption[];
      defaultIndex: number;
    }
);

interface TextStepProps {
  value: string;
  placeholder?: string;
  validate: (value: string) => boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

function TextStep({
  value,
  placeholder,
  validate,
  onChange,
  onSubmit,
}: TextStepProps) {
  const [inputValue, setInputValue] = useState(value);
  const [validationFailed, setValidationFailed] = useState(false);
  const { isFocused } = useFocus({ autoFocus: true });

  // Sync internal state with prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    if (validationFailed) {
      setValidationFailed(false);
    }
  };

  const handleSubmit = (value: string) => {
    // Use placeholder if input is empty
    const finalValue = value || placeholder || '';
    if (!validate(finalValue)) {
      setValidationFailed(true);
      return;
    }
    onSubmit(finalValue);
  };

  // Handle input manually when validation fails
  useInput(
    (input, key) => {
      if (!validationFailed) return;

      if (key.return) {
        handleSubmit(inputValue);
      } else if (key.backspace || key.delete) {
        const newValue = inputValue.slice(0, -1);
        handleChange(newValue);
      } else if (!key.ctrl && !key.meta && input) {
        const newValue = inputValue + input;
        handleChange(newValue);
      }
    },
    { isActive: validationFailed }
  );

  // When validation fails, show colored text
  if (validationFailed) {
    return (
      <Text color={Colors.Status.Error}>
        {inputValue || placeholder}
        {isFocused && <Text inverse> </Text>}
      </Text>
    );
  }

  return (
    <TextInput
      value={inputValue}
      onChange={handleChange}
      onSubmit={handleSubmit}
      placeholder={placeholder}
    />
  );
}

interface SelectionStepProps {
  options: ConfigOption[];
  selectedIndex: number;
  isCurrentStep: boolean;
}

function SelectionStep({
  options,
  selectedIndex,
  isCurrentStep,
}: SelectionStepProps) {
  return (
    <Box>
      {options.map((option, optIndex) => {
        const isSelected = optIndex === selectedIndex;
        return (
          <Box key={option.value} marginRight={2}>
            <Text dimColor={!isSelected || !isCurrentStep} bold={isSelected}>
              {option.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Config view: Multi-step configuration form
 */

export interface ConfigViewProps {
  steps: ConfigStep[];
  state: ConfigState;
  status: ComponentStatus;
  debug?: DebugLevel;
  onInputChange?: (value: string) => void;
  onInputSubmit?: (value: string) => void;
}

export const ConfigView = ({
  steps,
  state,
  status,
  debug = DebugLevel.None,
  onInputChange,
  onInputSubmit,
}: ConfigViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { values, completedStep, selectedIndex } = state;

  const renderStepInput = (
    stepConfig: ConfigStep,
    isCurrentStep: boolean
  ): ReactElement => {
    const configKey = stepConfig.path || stepConfig.key;
    const displayValue = values[configKey];

    switch (stepConfig.type) {
      case StepType.Text:
        if (isCurrentStep && onInputChange && onInputSubmit) {
          return (
            <TextStep
              value={values[configKey] || ''}
              placeholder={stepConfig.value || undefined}
              validate={stepConfig.validate}
              onChange={onInputChange}
              onSubmit={onInputSubmit}
            />
          );
        }
        return (
          <Text dimColor wrap="truncate-end">
            {displayValue || ''}
          </Text>
        );
      case StepType.Selection: {
        if (!isCurrentStep) {
          const option = stepConfig.options.find(
            (opt) => opt.value === displayValue
          );
          return <Text dimColor>{option?.label || ''}</Text>;
        }
        return (
          <SelectionStep
            options={stepConfig.options}
            selectedIndex={selectedIndex}
            isCurrentStep={true}
          />
        );
      }
      default: {
        const _exhaustiveCheck: never = stepConfig;
        throw new Error('Unsupported step type');
      }
    }
  };

  return (
    <Box flexDirection="column" marginLeft={1}>
      {steps.map((stepConfig, index) => {
        const isCurrentStep = index === completedStep && isActive;
        const isCompleted = index < completedStep;
        const wasAborted = index === completedStep && !isActive;
        const shouldShow = isCompleted || isCurrentStep || wasAborted;

        if (!shouldShow) {
          return null;
        }

        const postfix = getPostfix(stepConfig.path, debug);

        return (
          <Box
            key={stepConfig.path || stepConfig.key}
            flexDirection="column"
            marginTop={index === 0 ? 0 : 1}
          >
            <Box>
              <Text>{stepConfig.description}</Text>
              <Text>: </Text>
              {postfix && <Text color={Colors.Type.Config}>{postfix}</Text>}
            </Box>
            <Box>
              <Text> </Text>
              <Text color={Colors.Action.Select} dimColor={!isCurrentStep}>
                &gt;
              </Text>
              <Text> </Text>
              {renderStepInput(stepConfig, isCurrentStep)}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

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

        if (onAborted) {
          onAborted('configuration');
        }
        // Complete with abort feedback
        lifecycleHandlers.completeActive(
          createFeedback(FeedbackType.Aborted, 'Configuration cancelled.')
        );
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
          createFeedback(
            FeedbackType.Succeeded,
            'Configuration saved successfully.'
          )
        );
      } catch (error) {
        // Failure - complete with error feedback
        const errorMessage =
          error instanceof Error ? error.message : 'Configuration failed';
        lifecycleHandlers.completeActive(
          createFeedback(FeedbackType.Failed, errorMessage)
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
