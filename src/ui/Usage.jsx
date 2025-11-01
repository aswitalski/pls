import React from 'react';
import { Text, Box } from 'ink';
import { Welcome } from './Welcome.js';

export function Usage({ versionInfo, error }) {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Welcome versionInfo={versionInfo} />
      {error && (
        <Box marginBottom={1}>
          <Text color="red"> Error: {error}</Text>
        </Box>
      )}
      <Box marginBottom={1}>
        <Text color="yellow"> Usage: </Text>
        <Text>pls tell me </Text>
        <Text dimColor>&lt;question&gt;</Text>
      </Box>
    </Box>
  );
}
