import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';

const DEFAULT_WIDTH = 80;
const DEFAULT_PADDING = 1;

/**
 * Cell component - renders content within a table cell
 */
export interface CellProps {
  children: ReactNode;
  width?: number;
  padding?: number;
}

export const Cell = ({ children, padding = DEFAULT_PADDING }: CellProps) => (
  <Box paddingX={padding}>
    <Text wrap="wrap">{children}</Text>
  </Box>
);

/**
 * Column component - defines a column in the table
 */
export interface ColumnProps {
  children: ReactNode;
  width?: number;
}

export const Column = ({ children, width }: ColumnProps) => (
  <Box flexDirection="column" width={width}>
    {children}
  </Box>
);

/**
 * Row component - renders a single row with borders
 */
interface RowProps {
  children: ReactNode;
  color?: string;
  innerWidth: number;
}

const Row = ({ children, color, innerWidth }: RowProps) => (
  <Box>
    <Text color={color}>{'│'}</Text>
    <Box width={innerWidth}>{children}</Box>
    <Text color={color}>{'│'}</Text>
  </Box>
);

/**
 * Table component - renders data in a bordered table format
 */
export interface TableProps {
  data: string[];
  width?: number;
  color?: string;
}

export const Table = ({ data, width = DEFAULT_WIDTH, color }: TableProps) => {
  const innerWidth = width - 2;

  const TOP = '┌' + '─'.repeat(innerWidth) + '┐';
  const DIV = '├' + '─'.repeat(innerWidth) + '┤';
  const BOT = '└' + '─'.repeat(innerWidth) + '┘';

  return (
    <Box flexDirection="column">
      <Text color={color}>{TOP}</Text>
      {data.map((content, index) => (
        <React.Fragment key={index}>
          {index > 0 && <Text color={color}>{DIV}</Text>}
          <Row color={color} innerWidth={innerWidth}>
            <Cell>{content}</Cell>
          </Row>
        </React.Fragment>
      ))}
      <Text color={color}>{BOT}</Text>
    </Box>
  );
};
