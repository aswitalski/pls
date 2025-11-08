import React from 'react';
import { Box, Text } from 'ink';
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
}

export function Config<
  T extends Record<string, string> = Record<string, string>,
>({ steps, state, onFinished }: ConfigProps<T>) {
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

  const handleSubmit = (value: string) => {
    const currentStepConfig = steps[step];
    const finalValue = value.trim() || currentStepConfig.value || '';

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
        const isCompleted = index < step || done;
        const shouldShow = isCompleted || isCurrentStep;

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
              <Text color="cyan">&gt; </Text>
              {isCurrentStep ? (
                <TextInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSubmit={handleSubmit}
                />
              ) : (
                <Text dimColor>{values[stepConfig.key] || ''}</Text>
              )}
            </Box>
          </Box>
        );
      })}

      {step === steps.length && !done && (
        <Box marginY={1}>
          <Text color="green">✓ Configuration complete</Text>
        </Box>
      )}
    </Box>
  );
}
