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

import { ConfigStep, StepType } from '../views/Config.js';
import { Setting } from './Setting.js';
import { Spinner } from '../views/Spinner.js';

export {
  ConfigOption,
  ConfigState,
  ConfigStep,
  ConfigView,
  ConfigViewProps,
  StepType,
} from '../views/Config.js';

type TextConfigStep = ConfigStep & { type: StepType.Text };
type SelectionConfigStep = ConfigStep & { type: StepType.Selection };

function isTextStep(step: ConfigStep): step is TextConfigStep {
  return step.type === StepType.Text;
}

function isSelectionStep(step: ConfigStep): step is SelectionConfigStep {
  return step.type === StepType.Selection;
}

function initializeStepValues(steps: ConfigStep[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const step of steps) {
    const configKey = step.path || step.key;
    if (isTextStep(step)) {
      if (step.value !== null) {
        values[configKey] = step.value;
      }
    } else if (isSelectionStep(step)) {
      values[configKey] = step.options[step.defaultIndex].value;
    }
  }
  return values;
}

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
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initializeStepValues(initialSteps || [])
  );

  useEffect(() => {
    if (!isActive || !query || !service || initialSteps?.length) return;

    resolveQueryToSteps(query, service)
      .then((result) => {
        if (result.debug.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }
        setSteps(result.steps);
        setResolving(false);
        setValues(initializeStepValues(result.steps));
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

  const handleEscape = () => {
    requestHandlers.onCompleted({
      values,
      completedStep: currentStep,
      selectedIndex: 0,
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
  };

  useInput(
    (_, key) => {
      if (!isActive || currentStep >= steps.length) return;
      if (key.escape) {
        handleEscape();
      }
    },
    { isActive }
  );

  const handleEntrySubmit = (stepConfig: ConfigStep, value: string) => {
    const configKey = stepConfig.path || stepConfig.key;
    const newValues = { ...values, [configKey]: value };
    setValues(newValues);

    if (currentStep === steps.length - 1) {
      requestHandlers.onCompleted({
        values: newValues,
        completedStep: steps.length,
        selectedIndex: 0,
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
      setCurrentStep(steps.length);
    } else {
      setCurrentStep(currentStep + 1);
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
    <Box flexDirection="column" marginLeft={1}>
      {steps.map((stepConfig, index) => {
        const isStepActive = index === currentStep && isActive;
        const isCompleted = index < currentStep;
        const wasAborted = index === currentStep && !isActive;
        const shouldShow = isCompleted || isStepActive || wasAborted;

        if (!shouldShow) return null;

        const configKey = stepConfig.path || stepConfig.key;

        return (
          <Box key={configKey} marginTop={index === 0 ? 0 : 1}>
            <Setting
              step={stepConfig}
              initialValue={values[configKey] || ''}
              isActive={isStepActive}
              debug={debug}
              onSubmit={(value) => {
                handleEntrySubmit(stepConfig, value);
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
