import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { ValidateProps } from '../types/components.js';
import { ConfigRequirement } from '../types/skills.js';
import { TaskType } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';
import { saveConfig, unflattenConfig } from '../services/configuration.js';

import { Config, ConfigStep, StepType } from './Config.js';
import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

export function Validate({
  missingConfig,
  userRequest,
  state,
  isActive = true,
  service,
  children,
  debug,
  onError,
  onComplete,
  onAborted,
  handlers,
}: ValidateProps) {
  // isActive passed as prop
  const [error, setError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    null
  );
  const [configRequirements, setConfigRequirements] = useState<
    ConfigRequirement[] | null
  >(null);
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
            configRequirements: withDescriptions,
            validated: true,
          });
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);

          // Save error state
          handlers?.updateState({
            error: errorMessage,
          });

          if (onError) {
            onError(errorMessage);
          } else {
            setError(errorMessage);
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

  // Create ConfigSteps from requirements
  const configSteps: ConfigStep[] | null = configRequirements
    ? configRequirements.map((req) => ({
        description: req.description || req.path,
        key: req.path,
        path: req.path,
        type: StepType.Text,
        value: null,
        validate: () => true,
      }))
    : null;

  const handleConfigFinished = (config: Record<string, string>) => {
    // Convert flat dotted keys to nested structure grouped by section
    const configBySection = unflattenConfig(config);

    // Save each section
    for (const [section, sectionConfig] of Object.entries(configBySection)) {
      saveConfig(section, sectionConfig);
    }

    onComplete?.(configRequirements!);
  };

  const handleConfigAborted = (operation: string) => {
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

      {configSteps && !error && (
        <Box marginTop={1}>
          <Config
            steps={configSteps}
            isActive={isActive}
            debug={debug}
            onFinished={handleConfigFinished}
            onAborted={handleConfigAborted}
            handlers={handlers}
          />
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
