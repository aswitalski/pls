import React from 'react';
import { Box } from 'ink';

interface PanelProps {
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ children }) => {
  return (
    <Box
      borderStyle="round"
      borderColor="green"
      paddingX={3}
      paddingY={1}
      flexDirection="column"
    >
      {children}
    </Box>
  );
};
