import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentStatus,
  ValidateProps,
  ValidateState,
} from '../types/components.js';
import { ConfigRequirement } from '../types/skills.js';
import { TaskType } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { createConfigDefinitionWithKeys } from '../services/components.js';
import { saveConfig, unflattenConfig } from '../services/configuration.js';
import { saveConfigLabels } from '../services/config-labels.js';
import { useInput } from '../services/keyboard.js';
import {
  formatErrorMessage,
  getConfigValidationMessage,
} from '../services/messages.js';
import { ensureMinimumTime } from '../services/timing.js';
import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

/**
 * Validate view: Displays validation and config prompt
 */

export interface ValidateViewProps {
  state: ValidateState;
  status: ComponentStatus;
}

export const ValidateView = ({ state, status }: ValidateViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { error, completionMessage } = state;

  // Don't render when not active and nothing to show
  if (!isActive && !completionMessage && !error) {
    return null;
  }

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
    </Box>
  );
};

/**
 * Validate controller: Validates missing config
 */

export function Validate({
  missingConfig,
  userRequest,
  status,
  service,
  onError,
  requestHandlers,
  onValidationComplete,
  onAborted,
  lifecycleHandlers,
  workflowHandlers,
}: ValidateProps) {
  const isActive = status === ComponentStatus.Active;

  const [error, setError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    null
  );
  const [configRequirements, setConfigRequirements] = useState<
    ConfigRequirement[]
  >([]);

  useInput(
    (_, key) => {
      if (key.escape && isActive) {
        onAborted('validation');
      }
    },
    { isActive }
  );

  useEffect(() => {
    // Skip processing if not active
    if (!isActive) {
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        // Build prompt for VALIDATE tool
        const prompt = buildValidatePrompt(missingConfig, userRequest);

        // Call validate tool
        const result = await svc.processWithTool(prompt, 'validate');

        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          // Add debug components to timeline if present
          if (result.debug?.length) {
            workflowHandlers.addToTimeline(...result.debug);
          }

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
          const message = getConfigValidationMessage(withDescriptions.length);

          setCompletionMessage(message);
          setConfigRequirements(withDescriptions);

          // Invoke callback with config requirements
          onValidationComplete(withDescriptions);

          // Create Config component and add to queue
          const keys = withDescriptions.map((req) => req.path);
          const configDef = createConfigDefinitionWithKeys(
            keys,
            (config: Record<string, string>) => {
              // Convert flat dotted keys to nested structure grouped by section
              const configBySection = unflattenConfig(config);

              // Extract and save labels to cache
              const labels: Record<string, string> = {};
              for (const req of withDescriptions) {
                if (req.description) {
                  labels[req.path] = req.description;
                }
              }
              saveConfigLabels(labels);

              // Save each section
              for (const [section, sectionConfig] of Object.entries(
                configBySection
              )) {
                saveConfig(section, sectionConfig);
              }
            },
            (operation: string) => {
              onAborted(operation);
            }
          );

          // Override descriptions with LLM-generated ones
          if ('props' in configDef && 'steps' in configDef.props) {
            configDef.props.steps = configDef.props.steps.map(
              (step, index) => ({
                ...step,
                description:
                  withDescriptions[index].description ||
                  withDescriptions[index].path,
              })
            );
          }

          workflowHandlers.addToQueue(configDef);

          lifecycleHandlers.completeActive();

          const finalState: ValidateState = {
            error: null,
            completionMessage: message,
            configRequirements: withDescriptions,
            validated: true,
          };
          requestHandlers.onCompleted(finalState);
        }
      } catch (err) {
        await ensureMinimumTime(startTime, MIN_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);

          const finalState: ValidateState = {
            error: errorMessage,
            completionMessage: null,
            configRequirements: [],
            validated: false,
          };
          requestHandlers.onCompleted(finalState);

          onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [
    missingConfig,
    userRequest,
    isActive,
    service,
    requestHandlers,
    onError,
    onAborted,
    onValidationComplete,
    lifecycleHandlers,
    workflowHandlers,
  ]);

  const state: ValidateState = {
    error,
    completionMessage,
    configRequirements,
    validated: error === null && completionMessage !== null,
  };
  return <ValidateView state={state} status={status} />;
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
