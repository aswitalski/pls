import React from 'react';
import { Box } from 'ink';

import { ComponentDefinition } from '../types/components.js';

import { Component } from './Component.js';

interface ColumnProps {
  items: ComponentDefinition[];
}

export const Column: React.FC<ColumnProps> = ({ items }) => {
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
          <Component def={item} />
        </Box>
      ))}
    </Box>
  );
};
