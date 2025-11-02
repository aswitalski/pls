import React from 'react';
import { Text, Box } from 'ink';

interface AppInfo {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
}

interface WelcomeProps {
  info: AppInfo;
}

export function Welcome({ info: app }: WelcomeProps) {
  const descriptionLines = app.description
    .split('. ')
    .map((line) => line.replace(/\.$/, ''))
    .filter(Boolean);

  return (
    <Box alignSelf="flex-start" marginTop={1}>
      <Box
        borderStyle="round"
        borderColor="green"
        paddingX={3}
        paddingY={1}
        marginBottom={1}
        flexDirection="column"
      >
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Please... </Text>
            <Text color="grey">( </Text>
            <Text color="greenBright" bold>
              pls
            </Text>
            <Text> v{app.version}</Text>
            {app.isDev && <Text color="yellowBright"> dev</Text>}
            <Text color="grey"> )</Text>
          </Box>
        </Box>
        <Box marginBottom={1}>
          <Text color="greenBright">Prompt Language Shell </Text>
          <Text>interface</Text>
        </Box>
        {descriptionLines.map((line, index) => (
          <Box key={index}>
            <Text dimColor>{line}.</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
