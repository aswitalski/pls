import { Box, Text } from 'ink';

import { Separator } from './Separator.js';

interface LabelProps {
  description: string;
  descriptionColor: string;
  type: string;
  typeColor: string;
  showType?: boolean;
}

export function Label({
  description,
  descriptionColor,
  type,
  typeColor,
  showType = false,
}: LabelProps) {
  return (
    <Box>
      <Text color={descriptionColor}>{description}</Text>
      {showType && (
        <>
          <Separator />
          <Text color={typeColor}>{type}</Text>
        </>
      )}
    </Box>
  );
}
