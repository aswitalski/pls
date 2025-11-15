import React from 'react';
import { Box } from 'ink';

import { ComponentDefinition } from '../types/components.js';

import { Component } from './Component.js';

interface ColumnProps {
  items: ComponentDefinition[];
  debug: boolean;
}

export const Column: React.FC<ColumnProps> = React.memo(({ items, debug }) => {
  return (
    <Box
      marginTop={1}
      marginBottom={1}
      marginLeft={1}
      flexDirection="column"
      gap={1}
    >
      {items.map((item) => (
        <Box key={item.id}>
          <Component def={item} debug={debug} />
        </Box>
      ))}
    </Box>
  );
});
