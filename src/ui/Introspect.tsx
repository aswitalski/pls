import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { Capability, IntrospectProps } from '../types/components.js';
import { Task } from '../types/types.js';

import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';

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

function parseCapabilityFromTask(task: Task): Capability {
  // Parse "NAME: Description" format from task.action
  const colonIndex = task.action.indexOf(':');

  if (colonIndex === -1) {
    return {
      name: task.action,
      description: '',
      isBuiltIn: BUILT_IN_CAPABILITIES.has(task.action.toUpperCase()),
    };
  }

  const name = task.action.substring(0, colonIndex).trim();
  const description = task.action.substring(colonIndex + 1).trim();
  const isBuiltIn = BUILT_IN_CAPABILITIES.has(name.toUpperCase());

  return {
    name,
    description,
    isBuiltIn,
  };
}

export function Introspect({
  tasks,
  state,
  service,
  children,
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
          const capabilities = result.tasks.map(parseCapabilityFromTask);
          setIsLoading(false);
          onComplete?.(result.message, capabilities);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error occurred';
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
  }, [tasks, done, service]);

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
