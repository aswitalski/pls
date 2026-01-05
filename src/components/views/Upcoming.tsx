import { Box, Text } from 'ink';

import { Palette } from '../../services/colors.js';
import { ExecutionStatus } from '../../services/shell.js';

/**
 * Branching symbols for tree-like display
 */
const BRANCH_MIDDLE = '├─';
const BRANCH_LAST = '└─';

/**
 * Status types relevant for upcoming display
 */
export type UpcomingStatus =
  | ExecutionStatus.Pending
  | ExecutionStatus.Failed
  | ExecutionStatus.Aborted;

/**
 * Props for Upcoming component
 */
export interface UpcomingProps {
  items: string[];
  status?: UpcomingStatus;
}

/**
 * Labels for each status
 */
const STATUS_LABELS: Record<UpcomingStatus, string> = {
  [ExecutionStatus.Pending]: 'Next:',
  [ExecutionStatus.Failed]: 'Skipped:',
  [ExecutionStatus.Aborted]: 'Cancelled:',
};

/**
 * Upcoming: Displays upcoming tasks in a tree-like structure
 */
export const Upcoming = ({
  items,
  status = ExecutionStatus.Pending,
}: UpcomingProps) => {
  if (items.length === 0) return null;

  const strikethrough = status !== ExecutionStatus.Pending;

  return (
    <Box flexDirection="column" marginLeft={1}>
      <Text color={Palette.Gray}>{STATUS_LABELS[status]}</Text>
      {items.map((name, index) => {
        const isLast = index === items.length - 1;
        const symbol = isLast ? BRANCH_LAST : BRANCH_MIDDLE;
        return (
          <Box key={index} marginLeft={1}>
            <Text color={Palette.DarkGray} strikethrough={strikethrough}>
              {symbol} {name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
