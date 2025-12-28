import { Box, Text } from 'ink';

import { TaskType } from '../types/types.js';

import { getTaskColors, getTaskTypeLabel } from '../services/colors.js';
import { DebugLevel } from '../configuration/types.js';

import { Separator } from './Separator.js';
import { ComponentStatus } from '../types/components.js';

interface LabelProps {
  description: string;
  taskType: TaskType;
  showType?: boolean;
  status?: ComponentStatus;
  debug?: DebugLevel;
}

export function Label({
  description,
  taskType,
  showType = false,
  status = ComponentStatus.Done,
  debug = DebugLevel.None,
}: LabelProps) {
  const colors = getTaskColors(taskType, status);

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
