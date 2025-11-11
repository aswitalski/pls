import React from 'react';
import { Box, Text } from 'ink';

import { Label } from './Label.js';

type ColoredText = { text: string; color: string; highlightedColor?: string };

interface ListItem {
  description: ColoredText;
  type: ColoredText;
  children?: ListItem[];
  highlighted?: boolean;
  marker?: string;
}

interface ListProps {
  items: ListItem[];
  level?: number;
  highlightedIndex?: number | null;
  highlightedParentIndex?: number | null;
}

export const List: React.FC<ListProps> = ({
  items,
  level = 0,
  highlightedIndex = null,
  highlightedParentIndex = null,
}) => {
  const marginLeft = level > 0 ? 4 : 0;

  return (
    <Box flexDirection="column" marginLeft={marginLeft}>
      {items.map((item, index) => {
        // At level 0, track which parent is active for child highlighting
        // At level > 0, only highlight if this parent is the active one
        const shouldHighlightChildren =
          level === 0 ? highlightedParentIndex === index : false;
        const isHighlighted =
          item.highlighted || (level > 0 && index === highlightedIndex);
        const marker = item.marker || (isHighlighted ? '  → ' : '  - ');

        // Use highlighted colors if available and item is highlighted
        const descriptionColor =
          isHighlighted && item.description.highlightedColor
            ? item.description.highlightedColor
            : item.description.color;
        const typeColor =
          isHighlighted && item.type.highlightedColor
            ? item.type.highlightedColor
            : item.type.color;

        return (
          <Box key={index} flexDirection="column">
            <Box>
              <Text color="whiteBright">{marker}</Text>
              <Label
                description={item.description.text}
                descriptionColor={descriptionColor}
                type={item.type.text}
                typeColor={typeColor}
              />
            </Box>
            {item.children && item.children.length > 0 && (
              <List
                items={item.children}
                level={level + 1}
                highlightedIndex={
                  shouldHighlightChildren ? highlightedIndex : null
                }
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};
