import { Box, Text } from 'ink';

import { Capability, ReportProps } from '../../types/components.js';

import { Colors, getOriginColor } from '../../services/colors.js';

function CapabilityItem({
  name,
  description,
  origin,
  isIncomplete,
}: Capability) {
  const color = getOriginColor(origin);

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
            origin={capability.origin}
            isIncomplete={capability.isIncomplete}
          />
        ))}
      </Box>
    </Box>
  );
}
