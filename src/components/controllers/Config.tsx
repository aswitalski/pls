import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentDefinition,
  ComponentStatus,
  ConfigProps,
} from '../../types/components.js';
import { FeedbackType, TaskType } from '../../types/types.js';

import { createFeedback } from '../../services/components.js';
import { createConfigStepsFromSchema } from '../../configuration/steps.js';
import { saveConfigLabels } from '../../configuration/labels.js';
import { DebugLevel } from '../../configuration/types.js';
import { useInput } from '../../services/keyboard.js';

import { ConfigStep, ConfigView, StepType } from '../views/Config.js';
import { Spinner } from '../views/Spinner.js';

export {
  ConfigOption,
  ConfigState,
  ConfigStep,
  ConfigView,
  ConfigViewProps,
  StepType,
} from '../views/Config.js';

interface ResolveResult {
  steps: ConfigStep[];
  debug: ComponentDefinition[];
}

/**
 * Resolve query to config steps via CONFIGURE tool
 */
async function resolveQueryToSteps(
  query: string,
  service: NonNullable<ConfigProps['service']>
): Promise<ResolveResult> {
  const result = await service.processWithTool(query, 'configure');

  const configTasks = result.tasks.filter(
    (task) => task.type === TaskType.Config && task.params?.key
  );

  if (configTasks.length === 0) {
    throw new Error('No configuration settings matched your query.');
  }

  const keys = configTasks.map((task) => task.params?.key as string);
  const labels: Record<string, string> = {};
  for (const task of configTasks) {
    const key = task.params?.key as string;
    if (key && task.action) {
      labels[key] = task.action;
    }
  }

  if (Object.keys(labels).length > 0) {
    saveConfigLabels(labels);
  }

  const steps = createConfigStepsFromSchema(keys);
  return {
    steps: steps.map((step, i) => ({
      ...step,
      description: labels[keys[i]] || step.description,
    })),
    debug: result.debug || [],
  };
}

/**
 * Config controller: Multi-step wizard logic
 */
export function Config<
  T extends Record<string, string> = Record<string, string>,
>(props: ConfigProps<T>) {
  const {
    steps: initialSteps,
    query,
    service,
    status,
    debug = DebugLevel.None,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
    onFinished,
    onAborted,
  } = props;
  const isActive = status === ComponentStatus.Active;

  const [steps, setSteps] = useState<ConfigStep[]>(initialSteps || []);
  const [resolving, setResolving] = useState(!initialSteps?.length && !!query);
  const [step, setStep] = useState<number>(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (initialSteps || []).forEach((stepConfig) => {
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
      }
    });
    return initial;
  });
  const [inputValue, setInputValue] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (!initialSteps?.length) return 0;
    const first = initialSteps[0];
    return first.type === StepType.Selection ? first.defaultIndex : 0;
  });

  // Resolve query to steps
  useEffect(() => {
    if (!isActive || !query || !service || initialSteps?.length) return;

    resolveQueryToSteps(query, service)
      .then((result) => {
        // Add debug components to timeline if present
        if (result.debug.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }

        setSteps(result.steps);
        setResolving(false);
        // Initialize values for resolved steps
        const initial: Record<string, string> = {};
        result.steps.forEach((stepConfig) => {
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
          }
        });
        setValues(initial);
      })
      .catch((err: unknown) => {
        setResolving(false);
        lifecycleHandlers.completeActive(
          createFeedback({
            type: FeedbackType.Failed,
            message: err instanceof Error ? err.message : 'Failed to resolve',
          })
        );
      });
  }, [
    isActive,
    query,
    service,
    initialSteps,
    lifecycleHandlers,
    workflowHandlers,
  ]);

  // Update inputValue and selectedIndex when step changes
  useEffect(() => {
    if (isActive && step < steps.length) {
      const stepConfig = steps[step];
      const configKey = stepConfig.path || stepConfig.key;
      setInputValue(values[configKey] || '');
      if (stepConfig.type === StepType.Selection) {
        setSelectedIndex(stepConfig.defaultIndex);
      }
    }
  }, [step, isActive, steps, values]);

  const normalizeValue = (value: string | null | undefined) => {
    if (value === null || value === undefined) return '';
    return value.replace(/\n/g, '').trim();
  };

  useInput(
    (_, key) => {
      if (!isActive || step >= steps.length) return;

      const currentStepConfig = steps[step];

      if (key.escape) {
        const configKey = currentStepConfig.path || currentStepConfig.key;
        let currentValue = '';
        switch (currentStepConfig.type) {
          case StepType.Text:
            currentValue = inputValue || values[configKey] || '';
            break;
          case StepType.Selection:
            currentValue = values[configKey] || '';
            break;
        }
        const finalValues = currentValue
          ? { ...values, [configKey]: currentValue }
          : values;

        requestHandlers.onCompleted({
          values: finalValues,
          completedStep: step,
          selectedIndex,
          steps,
        });

        if (onAborted) {
          onAborted('configuration');
        } else {
          lifecycleHandlers.completeActive(
            createFeedback({
              type: FeedbackType.Aborted,
              message: 'Configuration cancelled.',
            })
          );
        }
        return;
      }

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
        finalValue = value;
        break;
      case StepType.Text: {
        const normalizedInput = normalizeValue(value);
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
    }

    if (!finalValue) return;

    const configKey = currentStepConfig.path || currentStepConfig.key;
    const newValues = { ...values, [configKey]: finalValue };
    setValues(newValues);
    setInputValue('');

    if (step === steps.length - 1) {
      requestHandlers.onCompleted({
        values: newValues,
        completedStep: steps.length,
        selectedIndex,
        steps,
      });

      try {
        onFinished?.(newValues as T);
        lifecycleHandlers.completeActive(
          createFeedback({
            type: FeedbackType.Succeeded,
            message: 'Configuration saved successfully.',
          })
        );
      } catch (error) {
        lifecycleHandlers.completeActive(
          createFeedback({
            type: FeedbackType.Failed,
            message:
              error instanceof Error ? error.message : 'Configuration failed',
          })
        );
      }
      setStep(steps.length);
    } else {
      setStep(step + 1);
    }
  };

  if (resolving) {
    return (
      <Box marginLeft={1}>
        <Text>Resolving configuration... </Text>
        <Spinner />
      </Box>
    );
  }

  return (
    <ConfigView
      steps={steps}
      state={{ values, completedStep: step, selectedIndex }}
      status={status}
      debug={debug}
      onInputChange={setInputValue}
      onInputSubmit={handleSubmit}
    />
  );
}
