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
        <Box flexDirection="column">
          <Box marginBottom={1} gap={1}>
            <Text color="whiteBright" dimColor>
              &gt;
            </Text>
            <Text>please</Text>
            <Text color="whiteBright" dimColor>(</Text>
            <Text color="greenBright" bold>
              pls
            </Text>
            <Text color="whiteBright" dimColor>)</Text>
            <Text>do stuff</Text>
          </Box>
        </Box>
        <Box marginBottom={1} gap={1}>
          {words.map((word, index) => (
            <Text color="greenBright" key={index}>
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
            <Text color="whiteBright" dimColor>
              {line}.
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
