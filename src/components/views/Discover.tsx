import { useMemo } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { Colors, getTextColor, Palette } from '../../services/colors.js';
import { ExecuteCommand, ExecutionStatus } from '../../services/shell.js';

import { Spinner } from './Spinner.js';
import { Upcoming } from './Upcoming.js';

/**
 * Props for DiscoverView - display-ready data
 */
export interface DiscoverViewProps {
  status: ComponentStatus;
  action: string;
  phase: 'discovering' | 'executing' | 'done';
  message: string | null;
  command: ExecuteCommand | null;
  output: string | null;
  error: string | null;
  upcoming?: string[];
  cancelled?: boolean;
}

function getDiscoverLoadingMessage(): string {
  const messages = [
    'Figuring out the command.',
    'Determining the right approach.',
    'Working on it.',
    'Finding the best command.',
    'Analyzing your request.',
    'Let me find the right command.',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Discover view: Displays discovery and execution phases
 */
export const DiscoverView = ({
  status,
  action,
  phase,
  message,
  command,
  output,
  error,
  upcoming,
  cancelled = false,
}: DiscoverViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const loadingMessage = useMemo(() => getDiscoverLoadingMessage(), []);

  // Determine upcoming status: cancelled, error, or pending
  const isTerminated = cancelled || error !== null;
  const upcomingStatus = cancelled
    ? ExecutionStatus.Aborted
    : error
      ? ExecutionStatus.Failed
      : ExecutionStatus.Pending;

  // Build full list of items to show - include current action when terminated
  const upcomingItems =
    isTerminated && upcoming ? [action, ...upcoming] : (upcoming ?? []);
  const showUpcoming = upcomingItems.length > 0 && (isActive || isTerminated);

  // Split output into lines for display
  const outputLines = output ? output.split('\n').filter((l) => l) : null;

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {/* Action being discovered */}
      <Box marginLeft={1} marginBottom={1}>
        <Text color={getTextColor(isActive)}>{action}</Text>
      </Box>

      {/* Phase: Discovering */}
      {isActive && phase === 'discovering' && (
        <Box paddingLeft={3} marginBottom={1}>
          <Text color={getTextColor(isActive)}>{loadingMessage} </Text>
          <Spinner />
        </Box>
      )}

      {/* Phase: Executing */}
      {isActive && phase === 'executing' && command && (
        <Box flexDirection="column" paddingLeft={3}>
          {message && (
            <Text color={Palette.Gray} dimColor>
              {message}
            </Text>
          )}
          <Text color={Palette.Gray} dimColor>
            $ {command.command}
          </Text>
          <Box marginTop={1}>
            <Spinner />
          </Box>
        </Box>
      )}

      {/* Phase: Done */}
      {phase === 'done' && command && (
        <Box flexDirection="column" paddingLeft={3}>
          {message && <Text color={Palette.AshGray}>{message}</Text>}
          <Text color={Palette.Gray}>$ {command.command}</Text>
          {outputLines && outputLines.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {outputLines.slice(0, 20).map((line, index) => (
                <Text color={getTextColor(isActive)} key={index}>
                  {line}
                </Text>
              ))}
              {outputLines.length > 20 && (
                <Text color={Palette.Gray} dimColor>
                  ... ({outputLines.length - 20} more lines)
                </Text>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Upcoming tasks */}
      {showUpcoming && (
        <Box marginTop={1}>
          <Upcoming items={upcomingItems} status={upcomingStatus} />
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
};
