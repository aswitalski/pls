import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { Capability, IntrospectProps } from '../types/components.js';
import { Task } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 1000;

const BUILT_IN_CAPABILITIES = new Set([
  'CONFIG',
  'PLAN',
  'INTROSPECT',
  'ANSWER',
  'EXECUTE',
  'REPORT',
]);

const INDIRECT_CAPABILITIES = new Set(['PLAN', 'REPORT']);

function parseCapabilityFromTask(task: Task): Capability {
  // Parse "NAME: Description" format from task.action
  const colonIndex = task.action.indexOf(':');

  if (colonIndex === -1) {
    const upperName = task.action.toUpperCase();
    return {
      name: task.action,
      description: '',
      isBuiltIn: BUILT_IN_CAPABILITIES.has(upperName),
      isIndirect: INDIRECT_CAPABILITIES.has(upperName),
    };
  }

  const name = task.action.substring(0, colonIndex).trim();
  const description = task.action.substring(colonIndex + 1).trim();
  const upperName = name.toUpperCase();
  const isBuiltIn = BUILT_IN_CAPABILITIES.has(upperName);
  const isIndirect = INDIRECT_CAPABILITIES.has(upperName);

  return {
    name,
    description,
    isBuiltIn,
    isIndirect,
  };
}

export function Introspect({
  tasks,
  state,
  service,
  children,
  debug = false,
  onError,
  onComplete,
  onAborted,
}: IntrospectProps) {
  const done = state?.done ?? false;
  const isCurrent = done === false;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? !done);

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
        // Get the introspect task action (first task should have the intro message)
        const introspectAction = tasks[0]?.action || 'list capabilities';

        // Call introspect tool
        const result = await svc!.processWithTool(
          introspectAction,
          'introspect'
        );
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          // Parse capabilities from returned tasks
          let capabilities = result.tasks.map(parseCapabilityFromTask);

          // Filter out internal capabilities when not in debug mode
          if (!debug) {
            capabilities = capabilities.filter(
              (cap) =>
                cap.name.toUpperCase() !== 'PLAN' &&
                cap.name.toUpperCase() !== 'REPORT'
            );
          }

          setIsLoading(false);
          onComplete?.(result.message, capabilities);
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
  }, [tasks, done, service, debug, onComplete, onError]);

  // Don't render wrapper when done and nothing to show
  if (!isLoading && !error && !children) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box>
          <Text color={getTextColor(isCurrent)}>Listing capabilities. </Text>
          <Spinner />
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
