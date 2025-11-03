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

  // Transform package name: "prompt-language-shell" -> "Prompt Language Shell"
  const words = app.name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

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
        <Box marginBottom={1} gap={1}>
          {words.map((word, index) => (
            <Text color="greenBright" bold key={index}>
              {word}
            </Text>
          ))}
          <Text color="whiteBright" dimColor>
            v{app.version}
          </Text>
          {app.isDev && <Text color="yellowBright">dev</Text>}
        </Box>
        {descriptionLines.map((line, index) => (
          <Box key={index}>
            <Text color="white">
              {line}.
            </Text>
          </Box>
        ))}
        <Box flexDirection="column" marginTop={1}>
          <Text color="brightWhite" bold>Usage:</Text>
          <Box gap={1}>
            <Text color="whiteBright" dimColor>
              &gt;
            </Text>
            <Box gap={1}>
              <Text color="greenBright" bold>
                pls
              </Text>
              <Text color="yellow" bold>[describe your request]</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
