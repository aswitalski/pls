import React from 'react';
import { Box, Text } from 'ink';

import { Separator } from './Separator.js';

type ColoredText = { text: string; color: string };

interface ListItem {
  description: ColoredText;
  type: ColoredText;
  children?: ListItem[];
}

interface ListProps {
  items: ListItem[];
  level?: number;
}

export const List: React.FC<ListProps> = ({ items, level = 0 }) => {
  const marginLeft = level > 0 ? 4 : 0;

  return (
    <Box flexDirection="column" marginLeft={marginLeft}>
      {items.map((item, index) => (
        <Box key={index} flexDirection="column">
          <Box>
            <Text color="whiteBright">{'  - '}</Text>
            <Text color={item.description.color}>{item.description.text}</Text>
            <Separator />
            <Text color={item.type.color}>{item.type.text}</Text>
          </Box>
          {item.children && item.children.length > 0 && (
            <List items={item.children} level={level + 1} />
          )}
        </Box>
      ))}
    </Box>
  );
};
