import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { ValidateProps } from '../types/components.js';
import { ConfigRequirement } from '../types/skills.js';
import { TaskType } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

export function Validate({
  missingConfig,
  userRequest,
  state,
  service,
  children,
  onError,
  onComplete,
  onAborted,
}: ValidateProps) {
  const done = state?.done ?? false;
  const isCurrent = done === false;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? !done);
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    null
  );

  useInput(
    (input, key) => {
      if (key.escape && isLoading && !done) {
        setIsLoading(false);
        onAborted();
      }
    },
    { isActive: isLoading && !done }
  );

  useEffect(() => {
    // Skip processing if done
    if (done) {
      return;
    }

    // Skip processing if no service available
    if (!service) {
      setError('No service available');
      setIsLoading(false);
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
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

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
          setIsLoading(false);
          onComplete?.(withDescriptions);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setIsLoading(false);
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
    done,
    service,
    onComplete,
    onError,
    onAborted,
  ]);

  // Don't render when done and nothing to show
  if (done && !completionMessage && !error && !children) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box>
          <Text color={getTextColor(isCurrent)}>
            Validating configuration requirements.{' '}
          </Text>
          <Spinner />
        </Box>
      )}

      {completionMessage && !isLoading && (
        <Box>
          <Text color={getTextColor(isCurrent)}>{completionMessage}</Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
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
