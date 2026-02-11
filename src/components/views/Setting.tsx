import { useEffect, useState } from 'react';
import { Box, Text, useFocus } from 'ink';
import TextInput from 'ink-text-input';

import { Colors } from '../../services/colors.js';
import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';

import { ConfigOption, ConfigStep, StepType } from './Config.js';

function getPostfix(text: string | undefined, debugLevel: DebugLevel): string {
  if (debugLevel === DebugLevel.None || !text) {
    return '';
  }

  if (debugLevel === DebugLevel.Info) {
    return `{${text}}`;
  }

  return `{${text}} entry`;
}

interface TextInputStepProps {
  value: string;
  placeholder?: string;
  validate: (value: string) => boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

function TextInputStep({
  value,
  placeholder,
  validate,
  onChange,
  onSubmit,
}: TextInputStepProps) {
  const [inputValue, setInputValue] = useState(value);
  const [validationFailed, setValidationFailed] = useState(false);
  const { isFocused } = useFocus({ autoFocus: true });

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
    const finalValue = value || placeholder || '';
    if (!validate(finalValue)) {
      setValidationFailed(true);
      return;
    }
    onSubmit(finalValue);
  };

  useInput(
    (input, key) => {
      if (!validationFailed) {
        return;
      }

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
}

function SelectionStep({ options, selectedIndex }: SelectionStepProps) {
  return (
    <Box>
      {options.map((option, optIndex) => {
        const isSelected = optIndex === selectedIndex;
        return (
          <Box key={option.value} marginRight={2}>
            <Text dimColor={!isSelected} bold={isSelected}>
              {option.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

interface SavedValueProps {
  step: ConfigStep;
  value: string;
}

function SavedValue({ step, value }: SavedValueProps) {
  if (step.type === StepType.Selection) {
    const option = step.options.find((opt) => opt.value === value);
    return <Text dimColor>{option?.label || ''}</Text>;
  }
  return (
    <Text dimColor wrap="truncate-end">
      {value || ''}
    </Text>
  );
}

export interface SettingViewProps {
  step: ConfigStep;
  value: string;
  selectedIndex: number;
  isActive: boolean;
  debug?: DebugLevel;
  onInputChange?: (value: string) => void;
  onInputSubmit?: (value: string) => void;
}

export function SettingView({
  step,
  value,
  selectedIndex,
  isActive,
  debug = DebugLevel.None,
  onInputChange,
  onInputSubmit,
}: SettingViewProps) {
  const postfix = getPostfix(step.path, debug);

  const renderInput = () => {
    if (!isActive) {
      return <SavedValue step={step} value={value} />;
    }

    if (step.type === StepType.Text && onInputChange && onInputSubmit) {
      return (
        <TextInputStep
          value={value}
          placeholder={step.value || undefined}
          validate={step.validate}
          onChange={onInputChange}
          onSubmit={onInputSubmit}
        />
      );
    }

    if (step.type === StepType.Selection) {
      return (
        <SelectionStep options={step.options} selectedIndex={selectedIndex} />
      );
    }

    return <SavedValue step={step} value={value} />;
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{step.description}</Text>
        <Text>: </Text>
        {postfix && <Text color={Colors.Type.Config}>{postfix}</Text>}
      </Box>
      <Box>
        <Text> </Text>
        <Text color={Colors.Action.Select} dimColor={!isActive}>
          &gt;
        </Text>
        <Text> </Text>
        {renderInput()}
      </Box>
    </Box>
  );
}
