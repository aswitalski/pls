import React from 'react';
import { Text, Box } from 'ink';

export function Welcome({ versionInfo }) {
  const version = versionInfo.replace('pls ', '');
  const isDev = version.includes('(dev)');
  const versionNumber = version.replace(' (dev)', '');

  return (
    <Box alignSelf='flex-start'>
      <Box
        borderStyle='round'
        borderColor='green'
        dimColor
        paddingX={3}
        paddingY={1}
        marginBottom={1}
        flexDirection='column'
      >
        <Box flexDirection='column'>
          <Box>
            <Text bold>Please </Text>
            <Text color='grey'>( </Text>
            <Text color='green' bold>pls</Text>
            <Text> v{versionNumber}</Text>
            {isDev && <Text color='yellowBright'> dev</Text>}
            <Text color='grey'> ) 💻</Text>
          </Box>
        </Box>
        <Box>
          <Text dimColor>Prompt Language Shell</Text>
        </Box>
        <Box>
          <Text dimColor>Your personal command line concierge</Text>
        </Box>
      </Box>
    </Box>
  );
}
