import { useState } from 'react';
import { Key } from 'ink';

import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';

import { ConfigStep, StepType } from '../views/Config.js';
import { SettingView } from '../views/Setting.js';

type SelectionConfigStep = ConfigStep & { type: StepType.Selection };

function isSelectionStep(step: ConfigStep): step is SelectionConfigStep {
  return step.type === StepType.Selection;
}

function normalizeTextValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.replace(/\n/g, '').trim();
}

export interface SettingProps {
  step: ConfigStep;
  initialValue: string;
  isActive: boolean;
  debug: DebugLevel;
  onSubmit: (value: string) => void;
}

export function Setting({
  step,
  initialValue,
  isActive,
  debug,
  onSubmit,
}: SettingProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (isSelectionStep(step)) {
      const index = step.options.findIndex((opt) => opt.value === initialValue);
      return index >= 0 ? index : step.defaultIndex;
    }
    return 0;
  });

  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const submitValue = (value: string) => {
    setInputValue(value);
    onSubmit(value);
  };

  const handleInputSubmit = (value: string) => {
    if (step.type === StepType.Text) {
      const normalizedInput = normalizeTextValue(value);
      if (normalizedInput && step.validate(normalizedInput)) {
        submitValue(normalizedInput);
        return;
      }
      if (step.value && step.validate(step.value)) {
        submitValue(step.value);
        return;
      }
    } else {
      submitValue(value);
    }
  };

  const handleSelectionNavigation = (key: Key) => {
    if (!isSelectionStep(step)) return;

    const len = step.options.length;
    if (key.tab || key.rightArrow) {
      setSelectedIndex((prev) => (prev + 1) % len);
    } else if (key.leftArrow) {
      setSelectedIndex((prev) => (prev - 1 + len) % len);
    } else if (key.return) {
      submitValue(step.options[selectedIndex].value);
    }
  };

  useInput(
    (_, key) => {
      if (!isActive || !isSelectionStep(step)) return;
      handleSelectionNavigation(key);
    },
    { isActive: isActive && isSelectionStep(step) }
  );

  return (
    <SettingView
      step={step}
      value={inputValue}
      selectedIndex={selectedIndex}
      isActive={isActive}
      debug={debug}
      onInputChange={handleInputChange}
      onInputSubmit={handleInputSubmit}
    />
  );
}
