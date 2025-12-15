import { Box, Text } from 'ink';

import { TaskType } from '../types/types.js';
import { DebugLevel } from '../services/configuration.js';
import { getTaskColors, getTaskTypeLabel } from '../services/colors.js';

import { Separator } from './Separator.js';

interface LabelProps {
  description: string;
  taskType: TaskType;
  showType?: boolean;
  isCurrent?: boolean;
  debug?: DebugLevel;
}

export function Label({
  description,
  taskType,
  showType = false,
  isCurrent = false,
  debug = DebugLevel.None,
}: LabelProps) {
  const colors = getTaskColors(taskType, isCurrent);

  return (
    <Box>
      <Text color={colors.description}>{description}</Text>
      {showType && (
        <>
          <Separator />
          <Text color={colors.type}>{getTaskTypeLabel(taskType, debug)}</Text>
        </>
      )}
    </Box>
  );
}
