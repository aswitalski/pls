import { Box, Text } from 'ink';

import { WelcomeProps } from '../../types/components.js';
import { App } from '../../types/types.js';

import { Palette } from '../../services/colors.js';

export function Welcome({ app }: WelcomeProps) {
  return (
    <Box marginLeft={2} flexDirection="column">
      <Header app={app} />
      <Description description={app.description} />
      <Usage />
    </Box>
  );
}

function Header({ app }: { app: App }) {
  const words = app.name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return (
    <Box marginBottom={1} gap={1}>
      {words.map((word, index) => (
        <Text color={Palette.Green} key={index}>
          {word}
        </Text>
      ))}
      <Text color={Palette.SoftWhite}>v{app.version}</Text>
      {app.isDev && <Text color={Palette.Yellow}>dev</Text>}
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
          <Text color={Palette.SoftWhite}>{line}.</Text>
        </Box>
      ))}
    </>
  );
}

function Usage() {
  return (
    <Box marginTop={1}>
      <Text>
        <Text color={Palette.SoftWhite}>To get started, type: </Text>
        <Text color={Palette.Green}>pls</Text>
        <Text color={Palette.Yellow}> help</Text>
      </Text>
    </Box>
  );
}
