import { ReactNode } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { Colors, getTextColor } from '../../services/colors.js';

import { Spinner } from './Spinner.js';

/**
 * Props for IntrospectView - display-ready data
 */
export interface IntrospectViewProps {
  status: ComponentStatus;
  hasCapabilities: boolean;
  error: string | null;
  children?: ReactNode;
}

/**
 * Introspect view: Displays capabilities list
 */
export const IntrospectView = ({
  status,
  hasCapabilities,
  error,
  children,
}: IntrospectViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const isLoading = isActive && !hasCapabilities && !error;

  // Don't render wrapper when done and nothing to show
  if (!isActive && !error && !children) {
    return null;
  }

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Listing capabilities. </Text>
          <Spinner />
        </Box>
      )}

      {error && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}

      {children}
    </Box>
  );
};
