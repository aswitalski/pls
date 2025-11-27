import React from 'react';
import { Box, Text } from 'ink';

import { Colors } from '../services/colors.js';

interface UserQueryProps {
  children: React.ReactNode;
}

export function UserQuery({ children }: UserQueryProps) {
  return (
    <Box
      paddingX={1}
      alignSelf="flex-start"
      backgroundColor={Colors.Background.UserQuery}
    >
      <Text color={Colors.Text.UserQuery}>{children}</Text>
    </Box>
  );
}
