import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { AnthropicService } from '../services/anthropic.js';

import { Spinner } from './Spinner.js';

const MIN_PROCESSING_TIME = 2000; // purelly for visual effect

interface CommandProps {
  rawCommand: string;
  claudeService: AnthropicService;
}

export function Command({ rawCommand, claudeService }: CommandProps) {
  const [processedTasks, setProcessedTasks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function process() {
      const startTime = Date.now();

      try {
        const result = await claudeService.processCommand(rawCommand);
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          setProcessedTasks(result);
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

    process();

    return () => {
      mounted = false;
    };
  }, [rawCommand, claudeService]);

  return (
    <Box
      alignSelf="flex-start"
      marginTop={1}
      marginBottom={1}
      flexDirection="column"
    >
      <Box>
        <Text color="gray">&gt; pls {rawCommand}</Text>
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
