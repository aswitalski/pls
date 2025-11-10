import { Box, Text } from 'ink';

import { Separator } from './Separator.js';

interface LabelProps {
  description: string;
  descriptionColor: string;
  type: string;
  typeColor: string;
}

export function Label({
  description,
  descriptionColor,
  type,
  typeColor,
}: LabelProps) {
  return (
    <Box>
      <Text color={descriptionColor}>{description}</Text>
      <Separator />
      <Text color={typeColor}>{type}</Text>
    </Box>
  );
}
