import { FC } from 'react';
import { Box, Text } from 'ink';

import { Palette } from '../services/colors.js';

import { Separator } from './Separator.js';

type ColoredText = {
  text: string;
  color: string | undefined;
  highlightedColor?: string | undefined;
};

interface ListItem {
  description: ColoredText;
  type: ColoredText;
  children?: ListItem[];
  highlighted?: boolean;
  marker?: string;
  markerColor?: string;
}

interface ListProps {
  items: ListItem[];
  level?: number;
  highlightedIndex?: number | null;
  highlightedParentIndex?: number | null;
  showType?: boolean;
}

export const List: FC<ListProps> = ({
  items,
  level = 0,
  highlightedIndex = null,
  highlightedParentIndex = null,
  showType = false,
}) => {
  const marginLeft = level > 0 ? 2 : 0;

  return (
    <Box flexDirection="column" marginLeft={marginLeft}>
      {items.map((item, index) => {
        // At level 0, track which parent is active for child highlighting
        // At level > 0, only highlight if this parent is the active one
        const shouldHighlightChildren =
          level === 0 ? highlightedParentIndex === index : false;
        const isHighlighted =
          item.highlighted || (level > 0 && index === highlightedIndex);
        const defaultMarker = level > 0 ? '  · ' : '  - ';
        const marker = item.marker || (isHighlighted ? '  → ' : defaultMarker);

        // Use highlighted colors if available and item is highlighted
        const descriptionColor =
          isHighlighted && item.description.highlightedColor
            ? item.description.highlightedColor
            : item.description.color;
        const typeColor =
          isHighlighted && item.type.highlightedColor
            ? item.type.highlightedColor
            : item.type.color;

        // Use highlighted type color for arrow markers when highlighted
        const markerColor =
          item.markerColor ||
          (isHighlighted && item.type.highlightedColor
            ? item.type.highlightedColor
            : Palette.White);

        return (
          <Box key={index} flexDirection="column">
            <Box>
              <Text color={markerColor}>{marker}</Text>
              <Text color={descriptionColor}>{item.description.text}</Text>
              {showType && (
                <>
                  <Separator />
                  <Text color={typeColor}>{item.type.text}</Text>
                </>
              )}
            </Box>
            {item.children && item.children.length > 0 && (
              <List
                items={item.children}
                level={level + 1}
                highlightedIndex={
                  shouldHighlightChildren ? highlightedIndex : null
                }
                showType={showType}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};
