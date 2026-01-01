import { FC, ReactNode } from 'react';
import { Box } from 'ink';

interface PanelProps {
  children: ReactNode;
}

export const Panel: FC<PanelProps> = ({ children }) => {
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
