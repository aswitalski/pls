import { Box, Text } from 'ink';

import { Capability, ReportProps } from '../types/components.js';
import { Colors } from '../services/colors.js';

function CapabilityItem({
  name,
  description,
  isBuiltIn,
  isIndirect,
}: Capability) {
  const color = isIndirect
    ? Colors.Origin.Indirect
    : isBuiltIn
      ? Colors.Origin.BuiltIn
      : Colors.Origin.UserProvided;

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
            isIndirect={capability.isIndirect}
          />
        ))}
      </Box>
    </Box>
  );
}
