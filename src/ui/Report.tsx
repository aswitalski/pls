import { Box, Text } from 'ink';

import { Capability, ReportProps } from '../types/components.js';

const COLORS = {
  BuiltIn: '#5c9ccc', // blue - for built-in capabilities
  UserDefined: '#5aaa8a', // green - for user-defined skills
} as const;

function CapabilityItem({ name, description, isBuiltIn }: Capability) {
  const color = isBuiltIn ? COLORS.BuiltIn : COLORS.UserDefined;

  return (
    <Box>
      <Text>- </Text>
      <Text color={color}>{name}</Text>
      <Text> - {description}</Text>
    </Box>
  );
}

export function Report({ message, capabilities }: ReportProps) {
  return (
    <Box flexDirection="column">
      <Text>{message}</Text>
      <Box flexDirection="column" marginLeft={2} marginTop={1}>
        {capabilities.map((capability, index) => (
          <CapabilityItem
            key={index}
            name={capability.name}
            description={capability.description}
            isBuiltIn={capability.isBuiltIn}
          />
        ))}
      </Box>
    </Box>
  );
}
