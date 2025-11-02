import React from 'react';
import { Text, Box } from 'ink';

export const Welcome = () => {
  return (
    <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
      <Box marginBottom={1}>
        <Text>
          <Text color="green">pls</Text> - your personal command-line concierge
        </Text>
      </Box>
      <Text color="yellow">Coming soon!</Text>
    </Box>
  );
};
