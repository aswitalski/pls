import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus, ValidateProps } from '../types/components.js';
import { ConfigRequirement } from '../types/skills.js';
import { TaskType } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import {
  addDebugToTimeline,
  createConfigStepsFromSchema,
} from '../services/components.js';
import {
  DebugLevel,
  saveConfig,
  unflattenConfig,
} from '../services/configuration.js';
import { saveConfigLabels } from '../services/config-labels.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Config, ConfigStep } from './Config.js';
import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

export function Validate({
  missingConfig,
  userRequest,
  state,
  status,
  service,
  children,
  debug = DebugLevel.None,
  onError,
  onComplete,
  onAborted,
  handlers,
}: ValidateProps) {
  const isActive = status === ComponentStatus.Active;
  const [error, setError] = useState<string | null>(state?.error ?? null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    state?.completionMessage ?? null
  );
  const [configRequirements, setConfigRequirements] = useState<
    ConfigRequirement[] | null
  >(state?.configRequirements ?? null);
  const [showConfig, setShowConfig] = useState(false);

  useInput(
    (_, key) => {
      if (key.escape && isActive && !showConfig) {
        onAborted('validation');
      }
    },
    { isActive: isActive && !showConfig }
  );

  useEffect(() => {
    // Skip processing if not active
    if (!isActive) {
      return;
    }

    // Skip processing if no service available
    if (!service) {
      setError('No service available');
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        // Build prompt for VALIDATE tool
        const prompt = buildValidatePrompt(missingConfig, userRequest);

        // Call validate tool
        const result = await svc!.processWithTool(prompt, 'validate');

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Add debug components to timeline if present
          addDebugToTimeline(result.debug, handlers);

          // Extract CONFIG tasks with descriptions from result
          const configTasks = result.tasks.filter(
            (task) => task.type === TaskType.Config
          );

          // Build ConfigRequirements with descriptions
          const withDescriptions: ConfigRequirement[] = configTasks.map(
            (task) => {
              const key =
                typeof task.params?.key === 'string'
                  ? task.params.key
                  : 'unknown';
              const original = missingConfig.find((req) => req.path === key);

              return {
                path: key,
                type: original?.type || 'string',
                description: task.action,
              };
            }
          );

          // Build completion message showing which config properties are needed
          const count = withDescriptions.length;
          const propertyWord = count === 1 ? 'property' : 'properties';

          // Shuffle between different message variations
          const messages = [
            `Additional configuration ${propertyWord} required.`,
            `Configuration ${propertyWord} needed.`,
            `Missing configuration ${propertyWord} detected.`,
            `Setup requires configuration ${propertyWord}.`,
          ];
          const message = messages[Math.floor(Math.random() * messages.length)];

          setCompletionMessage(message);
          setConfigRequirements(withDescriptions);

          // Save state after validation completes
          handlers?.updateState({
            completionMessage: message,
            configRequirements: withDescriptions,
            validated: true,
            error: null,
          });
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);

          // Save error state
          handlers?.updateState({
            error: errorMessage,
            completionMessage: null,
            configRequirements: null,
            validated: false,
          });

          if (onError) {
            onError(errorMessage);
          }
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [
    missingConfig,
    userRequest,
    isActive,
    service,
    onComplete,
    onError,
    onAborted,
  ]);

  // Don't render when not active and nothing to show
  if (!isActive && !completionMessage && !error && !children) {
    return null;
  }

  // Create ConfigSteps from requirements using createConfigStepsFromSchema
  // to load current values from config file, then override descriptions
  const configSteps: ConfigStep[] | null = configRequirements
    ? (() => {
        const keys = configRequirements.map((req) => req.path);
        const steps = createConfigStepsFromSchema(keys);

        // Override descriptions with LLM-generated ones
        return steps.map((step, index) => ({
          ...step,
          description:
            configRequirements[index].description ||
            configRequirements[index].path,
        }));
      })()
    : null;

  const handleConfigFinished = (config: Record<string, string>) => {
    // Convert flat dotted keys to nested structure grouped by section
    const configBySection = unflattenConfig(config);

    // Extract and save labels to cache
    if (configRequirements) {
      const labels: Record<string, string> = {};
      for (const req of configRequirements) {
        if (req.description) {
          labels[req.path] = req.description;
        }
      }
      saveConfigLabels(labels);
    }

    // Save each section
    for (const [section, sectionConfig] of Object.entries(configBySection)) {
      saveConfig(section, sectionConfig);
    }

    // Mark validation component as complete before invoking callback
    // This allows the workflow to proceed to execution
    handlers?.completeActive();

    // Invoke callback which will queue the Execute component
    onComplete?.(configRequirements!);
  };

  const handleConfigAborted = (operation: string) => {
    // Mark validation component as complete when aborted
    handlers?.completeActive();
    onAborted(operation);
  };

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isActive && !completionMessage && !error && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>
            Validating configuration requirements.{' '}
          </Text>
          <Spinner />
        </Box>
      )}

      {completionMessage && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>{completionMessage}</Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}

      {configSteps && configSteps.length > 0 && !error && (
        <Box marginTop={1}>
          <Config
            steps={configSteps}
            status={status}
            debug={debug}
            onFinished={handleConfigFinished}
            onAborted={handleConfigAborted}
            handlers={handlers}
          />
        </Box>
      )}

      {configSteps && configSteps.length === 0 && !error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>
            Error: No configuration steps generated. Please try again.
          </Text>
        </Box>
      )}

      {children}
    </Box>
  );
}

/**
 * Build prompt for VALIDATE tool
 */
function buildValidatePrompt(
  missingConfig: ConfigRequirement[],
  userRequest: string
): string {
  const configList = missingConfig
    .map((req) => `- Config path: ${req.path}\n  Type: ${req.type}`)
    .join('\n');

  return `User requested: "${userRequest}"

Missing configuration values:
${configList}

Generate natural language descriptions for these configuration values based on the skill context.`;
}
