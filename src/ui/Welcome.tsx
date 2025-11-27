import { ReactNode } from 'react';
import { Box, Text } from 'ink';

import { WelcomeProps } from '../types/components.js';
import { App } from '../types/types.js';

import { Palette } from '../services/colors.js';

import { Panel } from './Panel.js';

export function Welcome({ app }: WelcomeProps) {
  return (
    <Box alignSelf="flex-start">
      <Panel>
        <Header app={app} />
        <Description description={app.description} />
        <Usage />
      </Panel>
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
        <Text color={Palette.BrightGreen} bold key={index}>
          {word}
        </Text>
      ))}
      <Text color={Palette.AshGray}>v{app.version}</Text>
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
          <Text color={Palette.White}>{line}.</Text>
        </Box>
      ))}
    </>
  );
}

function Usage() {
  return (
    <Box flexDirection="column" marginTop={1} gap={1}>
      <Section title="Get started:">
        <Example>list skills</Example>
      </Section>
      <Section title="Usage:">
        <Example>[describe your request]</Example>
      </Section>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box flexDirection="column">
      <Text color={Palette.White}>{title}</Text>
      {children}
    </Box>
  );
}

function Example({ children }: { children: string }) {
  return (
    <Box gap={1}>
      <Text color={Palette.Gray}>&gt;</Text>
      <Text color={Palette.BrightGreen} bold>
        pls
      </Text>
      <Text color={Palette.Yellow}>{children}</Text>
    </Box>
  );
}
