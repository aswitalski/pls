import { Box, Text } from 'ink';

import { Capability, ReportProps } from '../types/components.js';
import { Colors } from '../services/colors.js';

function CapabilityItem({
  name,
  description,
  isBuiltIn,
  isIndirect,
  isIncomplete,
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
      {isIncomplete && <Text color={Colors.Status.Warning}> (incomplete)</Text>}
    </Box>
  );
}

export function Report({ message, capabilities }: ReportProps) {
  return (
    <Box flexDirection="column">
      <Box marginLeft={1}>
        <Text>{message}</Text>
      </Box>
      <Box flexDirection="column" marginLeft={3} marginTop={1}>
        {capabilities.map((capability, index) => (
          <CapabilityItem
            key={index}
            name={capability.name}
            description={capability.description}
            isBuiltIn={capability.isBuiltIn}
            isIndirect={capability.isIndirect}
            isIncomplete={capability.isIncomplete}
          />
        ))}
      </Box>
    </Box>
  );
}
