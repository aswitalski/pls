import React from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface ConfigStep {
  description: string;
  key: string;
  value: string | null;
}

interface ConfigState {
  done: boolean;
}

export interface ConfigProps<
  T extends Record<string, string> = Record<string, string>,
> {
  steps: ConfigStep[];
  state?: ConfigState;
  onFinished?: (config: T) => void;
  onAborted?: () => void;
}

export function Config<
  T extends Record<string, string> = Record<string, string>,
>({ steps, state, onFinished, onAborted }: ConfigProps<T>) {
  const done = state?.done ?? false;

  const [step, setStep] = React.useState<number>(done ? steps.length : 0);
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    steps.forEach((step) => {
      if (step.value !== null) {
        initial[step.key] = step.value;
      }
    });
    return initial;
  });
  const [inputValue, setInputValue] = React.useState('');

  const normalizeValue = (value: string | null | undefined) => {
    if (value === null || value === undefined) {
      return '';
    }
    return value.replace(/\n/g, '').trim();
  };

  useInput((input, key) => {
    if (key.escape && !done && step < steps.length) {
      if (onAborted) {
        onAborted();
      }
    }
  });

  const handleSubmit = (value: string) => {
    const currentStepConfig = steps[step];
    const finalValue =
      normalizeValue(value) || normalizeValue(currentStepConfig.value);

    // Don't allow empty value if step has no default (mandatory field)
    if (!finalValue && !currentStepConfig.value) {
      return;
    }

    const newValues = { ...values, [currentStepConfig.key]: finalValue };
    setValues(newValues);
    setInputValue('');

    if (step === steps.length - 1) {
      // Last step completed
      if (onFinished) {
        onFinished(newValues as T);
      }
      setStep(steps.length);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <Box flexDirection="column" marginLeft={1}>
      {steps.map((stepConfig, index) => {
        const isCurrentStep = index === step && !done;
        const isCompleted = index < step;
        const wasAborted = index === step && done;
        const shouldShow = isCompleted || isCurrentStep || wasAborted;

        if (!shouldShow) {
          return null;
        }

        return (
          <Box
            key={stepConfig.key}
            flexDirection="column"
            marginTop={index === 0 ? 0 : 1}
          >
            <Box>
              <Text>{stepConfig.description}:</Text>
            </Box>
            <Box>
              <Text> </Text>
              <Text color="#5c8cbc" dimColor={!isCurrentStep}>
                &gt;
              </Text>
              <Text> </Text>
              {isCurrentStep ? (
                <TextInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleSubmit}
                  placeholder={stepConfig.value || undefined}
                />
              ) : (
                <Text dimColor>{values[stepConfig.key] || ''}</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
