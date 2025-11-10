import React from 'react';
import { Box, Text } from 'ink';

import { Label } from './Label.js';

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
            <Label
              description={item.description.text}
              descriptionColor={item.description.color}
              type={item.type.text}
              typeColor={item.type.color}
            />
          </Box>
          {item.children && item.children.length > 0 && (
            <List items={item.children} level={level + 1} />
          )}
        </Box>
      ))}
    </Box>
  );
};
