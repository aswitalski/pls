import { Box, Text } from 'ink';

import { TaskType } from '../types/types.js';
import { getTaskColors } from '../services/colors.js';

import { Separator } from './Separator.js';

interface LabelProps {
  description: string;
  taskType: TaskType;
  showType?: boolean;
  isCurrent?: boolean;
}

export function Label({
  description,
  taskType,
  showType = false,
  isCurrent = false,
}: LabelProps) {
  const colors = getTaskColors(taskType, isCurrent);

  return (
    <Box>
      <Text color={colors.description}>{description}</Text>
      {showType && (
        <>
          <Separator />
          <Text color={colors.type}>{taskType}</Text>
        </>
      )}
    </Box>
  );
}
