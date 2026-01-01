import { type ReactElement, useEffect, useState } from 'react';
import { Box, Text, useFocus } from 'ink';
import TextInput from 'ink-text-input';

import { ComponentStatus } from '../../types/components.js';

import { Colors } from '../../services/colors.js';
import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';

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
