import { Box, Text } from 'ink';

import { AppInfo, WelcomeProps } from '../types/components.js';

import { Panel } from './Panel.js';

function Header({ app }: { app: AppInfo }) {
  const words = app.name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return (
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
  );
}

function Description({ description }: { description: string }) {
  const lines = description
    .split('. ')
    .map((line) => line.replace(/\.$/, ''))
    .filter(Boolean);

  return (
    <>
      {lines.map((line, index) => (
        <Box key={index}>
          <Text color="white">{line}.</Text>
        </Box>
      ))}
    </>
  );
}

function Usage() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="brightWhite" bold>
        Usage:
      </Text>
      <Box gap={1}>
        <Text color="whiteBright" dimColor>
          &gt;
        </Text>
        <Box gap={1}>
          <Text color="greenBright" bold>
            pls
          </Text>
          <Text color="yellow" bold>
            [describe your request]
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

export function Welcome({ app }: WelcomeProps) {
  return (
    <Box alignSelf="flex-start" marginBottom={1}>
      <Panel>
        <Header app={app} />
        <Description description={app.description} />
        <Usage />
      </Panel>
    </Box>
  );
}
