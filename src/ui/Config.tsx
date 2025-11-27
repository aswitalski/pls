import { ReactElement, useState } from 'react';
import { Box, Text, useFocus } from 'ink';
import TextInput from 'ink-text-input';

import { Handlers } from '../types/components.js';

import { Colors } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';

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

interface ConfigState {
  values?: Record<string, string>;
  completedStep?: number;
}

export interface ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> {
  steps: ConfigStep[];
  state?: ConfigState;
  isActive?: boolean;
  debug?: boolean;
  handlers?: Handlers;
  onFinished?: (config: T) => void;
  onAborted?: (operation: string) => void;
}

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

export function Config<
  T extends Record<string, string> = Record<string, string>,
>({
  steps,
  state,
  isActive = true,
  debug,
  handlers,
  onFinished,
  onAborted,
}: ConfigProps<T>) {
  // isActive passed as prop

  const [step, setStep] = useState<number>(
    !isActive ? (state?.completedStep ?? steps.length) : 0
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    // If not active and we have saved state values, use those
    if (!isActive && state?.values) {
      return state.values;
    }

    // Otherwise initialize from step defaults
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
          const exhaustiveCheck: never = stepConfig;
          throw new Error(`Unsupported step type: ${exhaustiveCheck}`);
        }
      }
    });
    return initial;
  });
  const [inputValue, setInputValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const firstStep = steps[0];
    return firstStep?.type === StepType.Selection ? firstStep.defaultIndex : 0;
  });

  const normalizeValue = (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return '';
    }
    return value.replace(/\n/g, '').trim();
  };

  useInput((input, key) => {
    if (key.escape && isActive && step < steps.length) {
      // Save current value before aborting
      const currentStepConfig = steps[step];
      if (currentStepConfig) {
        const configKey = currentStepConfig.path || currentStepConfig.key;
        let currentValue = '';
        switch (currentStepConfig.type) {
          case StepType.Text:
            currentValue = inputValue || values[configKey] || '';
            break;
          case StepType.Selection:
            currentValue =
              currentStepConfig.options[selectedIndex]?.value ||
              values[configKey] ||
              '';
            break;
          default: {
            const exhaustiveCheck: never = currentStepConfig;
            throw new Error(`Unsupported step type: ${exhaustiveCheck}`);
          }
        }
        if (currentValue) {
          setValues({ ...values, [configKey]: currentValue });
        }
      }
      if (onAborted) {
        onAborted('configuration');
      }
      return;
    }

    const currentStep = steps[step];
    if (isActive && step < steps.length && currentStep) {
      switch (currentStep.type) {
        case StepType.Selection:
          if (key.tab) {
            setSelectedIndex((prev) => (prev + 1) % currentStep.options.length);
          } else if (key.return) {
            handleSubmit(currentStep.options[selectedIndex].value);
          }
          break;
        case StepType.Text:
          // Text input handled by TextInput component
          break;
        default: {
          const exhaustiveCheck: never = currentStep;
          throw new Error(`Unsupported step type: ${exhaustiveCheck}`);
        }
      }
    }
  });

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
        const exhaustiveCheck: never = currentStepConfig;
        throw new Error(`Unsupported step type: ${exhaustiveCheck}`);
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
      if (onFinished) {
        onFinished(newValues as T);
      }

      // Save state before completing
      handlers?.updateState({
        values: newValues,
        completedStep: steps.length,
      });

      // Signal Workflow that config is complete
      handlers?.onComplete();

      setStep(steps.length);
    } else {
      // Save state after each step
      handlers?.updateState({
        values: newValues,
        completedStep: step + 1,
      });

      setStep(step + 1);
      // Reset selection index for next step
      const nextStep = steps[step + 1];
      if (nextStep?.type === StepType.Selection) {
        setSelectedIndex(nextStep.defaultIndex);
      }
    }
  };

  const renderStepInput = (
    stepConfig: ConfigStep,
    isCurrentStep: boolean
  ): ReactElement => {
    const configKey = stepConfig.path || stepConfig.key;
    // Use state values if not active (in timeline), otherwise use local values
    const displayValue =
      !isActive && state?.values ? state.values[configKey] : values[configKey];

    switch (stepConfig.type) {
      case StepType.Text:
        if (isCurrentStep) {
          return (
            <TextStep
              value={inputValue}
              placeholder={stepConfig.value || undefined}
              validate={stepConfig.validate}
              onChange={setInputValue}
              onSubmit={handleSubmit}
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
          const selectedOption = stepConfig.options.find(
            (opt) => opt.value === displayValue
          );
          return <Text dimColor>{selectedOption?.label || ''}</Text>;
        }
        return (
          <SelectionStep
            options={stepConfig.options}
            selectedIndex={selectedIndex}
            isCurrentStep={isCurrentStep}
          />
        );
      }
      default: {
        const exhaustiveCheck: never = stepConfig;
        throw new Error(`Unsupported step type: ${exhaustiveCheck}`);
      }
    }
  };

  return (
    <Box flexDirection="column" marginLeft={1}>
      {steps.map((stepConfig, index) => {
        const isCurrentStep = index === step && isActive;
        const isCompleted = index < step;
        const wasAborted = index === step && !isActive;
        const shouldShow = isCompleted || isCurrentStep || wasAborted;

        if (!shouldShow) {
          return null;
        }

        return (
          <Box
            key={stepConfig.path || stepConfig.key}
            flexDirection="column"
            marginTop={index === 0 ? 0 : 1}
          >
            <Box>
              <Text>{stepConfig.description}</Text>
              <Text>: </Text>
              {debug && stepConfig.path && (
                <Text color={Colors.Type.Define}>
                  {'{'}
                  {stepConfig.path}
                  {'}'}
                </Text>
              )}
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
}
