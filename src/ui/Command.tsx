import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { CommandProps } from '../types/components.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 2000; // purely for visual effect

export function Command({
  command,
  state,
  service,
  tasks,
  error: errorProp,
  systemPrompt: systemPromptProp,
}: CommandProps) {
  const done = state?.done ?? false;
  const [processedTasks, setProcessedTasks] = useState<string[]>(tasks || []);
  const [systemPrompt, setSystemPrompt] = useState<string | undefined>(
    systemPromptProp
  );
  const [error, setError] = useState<string | null>(
    state?.error || errorProp || null
  );
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? !done);

  useEffect(() => {
    // Skip processing if done (showing historical/final state)
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
        const result = await svc!.processCommand(command);
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          setProcessedTasks(result.tasks);
          setSystemPrompt(result.systemPrompt);
          setIsLoading(false);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Unknown error occurred'
          );
          setIsLoading(false);
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [command, done, service]);

  return (
    <Box alignSelf="flex-start" marginBottom={1} flexDirection="column">
      <Box>
        <Text color="gray">&gt; pls {command}</Text>
        {isLoading && (
          <>
            <Text> </Text>
            <Spinner />
          </>
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {processedTasks.length > 0 && (
        <Box flexDirection="column">
          {processedTasks.map((task, index) => (
            <Box key={index}>
              <Text color="whiteBright">{'  - '}</Text>
              <Text color="white">{task}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
