import { Box } from 'ink';

import { ComponentDefinition } from '../types/components.js';
import { renderComponent } from './renderComponent.js';

interface HistoryProps {
  items: ComponentDefinition[];
}

export function History({ items }: HistoryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" gap={1}>
      {items.map((item, index) => (
        <Box key={`${item.name}-${index}`}>{renderComponent(item)}</Box>
      ))}
    </Box>
  );
}
