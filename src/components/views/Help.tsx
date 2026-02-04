import { ReactNode } from 'react';
import { Box, Text } from 'ink';

import { HelpProps } from '../../types/components.js';

import { Palette } from '../../services/colors.js';

export function Help(_props: HelpProps) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Usage />
      <Shortcuts />
      <Configuration />
    </Box>
  );
}

function Usage() {
  return (
    <Section title="Here's how to ask me:" first>
      <Box marginLeft={2}>
        <Text>pls </Text>
        <Text color={Palette.Yellow}>{'<request>'}</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Command cmd="list skills" description="show available skills" />
        <Command cmd="help" description="show this help screen" />
      </Box>
    </Section>
  );
}

function Shortcuts() {
  return (
    <Section title="Keys you might find useful:">
      <Box flexDirection="column" marginLeft={2}>
        <Text color={Palette.AshGray}>Global:</Text>
        <Box flexDirection="column" marginLeft={2}>
          <Shortcut label="Shift+Tab" description="switch debug level" />
          <Shortcut label="Tab" description="cycle through options" />
          <Shortcut label="Up/Down" description="select from the list" />
          <Shortcut label="Enter" description="confirm selection" />
          <Shortcut label="Escape" description="cancel operation" />
        </Box>
      </Box>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Text color={Palette.AshGray}>Execution:</Text>
        <Box flexDirection="column" marginLeft={2}>
          <Shortcut label="/" description="enter input mode" />
          <Shortcut label="Enter" description="send input to the process" />
          <Shortcut
            label="Escape"
            description="dismiss input or cancel execution"
          />
        </Box>
      </Box>
    </Section>
  );
}

function Configuration() {
  return (
    <Section title="Where I keep my settings:">
      <Box marginLeft={2} gap={2}>
        <Box width={20}>
          <Text color={Palette.AshGray}>~/.plsrc</Text>
        </Box>
        <Text color={Palette.Gray}>runtime configuration</Text>
      </Box>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Text color={Palette.AshGray}>Required:</Text>
        <Box flexDirection="column" marginLeft={2}>
          <Item
            label="anthropic.key"
            description="API key"
            color={Palette.Green}
          />
          <Item
            label="anthropic.model"
            description="haiku, sonnet, opus"
            color={Palette.Green}
          />
        </Box>
      </Box>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        <Text color={Palette.AshGray}>Optional:</Text>
        <Box flexDirection="column" marginLeft={2}>
          <Item
            label="settings.debug"
            description="none, info, verbose"
            color={Palette.SteelBlue}
          />
          <Item
            label="settings.memory"
            description="process memory limit in MB"
            color={Palette.SteelBlue}
          />
        </Box>
      </Box>
    </Section>
  );
}

function Section({
  title,
  children,
  first,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <Box flexDirection="column" marginTop={first ? 0 : 1}>
      <Text color={Palette.SoftWhite}>{title}</Text>
      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}

function Shortcut({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <Box gap={2}>
      <Box width={18}>
        <Text color={Palette.BurntOrange}>{label}</Text>
      </Box>
      <Text color={Palette.Gray}>{description}</Text>
    </Box>
  );
}

function Command({ cmd, description }: { cmd: string; description: string }) {
  return (
    <Box gap={2}>
      <Box width={18}>
        <Text color={Palette.SoftWhite}>pls </Text>
        <Text color={Palette.Green}>{cmd}</Text>
      </Box>
      <Text color={Palette.Gray}>{description}</Text>
    </Box>
  );
}

function Item({
  label,
  description,
  color,
}: {
  label: string;
  description: string;
  color: string;
}) {
  return (
    <Box gap={2}>
      <Box width={18}>
        <Text color={color}>{label}</Text>
      </Box>
      <Text color={Palette.Gray}>{description}</Text>
    </Box>
  );
}
