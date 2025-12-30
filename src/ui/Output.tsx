import React from 'react';
import { Box, Text } from 'ink';

import { Palette } from '../services/colors.js';
import { ExecutionStatus } from '../services/shell.js';

const MAX_LINES = 8;
const MAX_WIDTH = 75;
const SHORT_OUTPUT_THRESHOLD = 4;
const MINIMAL_INFO_THRESHOLD = 2; // Show stdout too if stderr is 2 lines or fewer

export interface OutputProps {
  stdout: string;
  stderr: string;
  status: ExecutionStatus;
}

/**
 * Get the last N lines from text, filtering out empty/whitespace-only lines
 */
function getLastLines(text: string, maxLines: number = MAX_LINES): string[] {
  const lines = text
    .trim()
    .split(/\r?\n/) // Handle both \n and \r\n
    .filter((line) => line.trim().length > 0); // Filter empty/whitespace lines
  if (lines.length <= maxLines) return lines;
  return lines.slice(-maxLines);
}

export function Output({ stdout, stderr, status }: OutputProps) {
  const hasStdout = stdout.trim().length > 0;
  const hasStderr = stderr.trim().length > 0;

  if (!hasStdout && !hasStderr) return null;

  const stdoutLines = hasStdout ? getLastLines(stdout) : [];
  const stderrLines = hasStderr ? getLastLines(stderr) : [];

  // If stderr has minimal info (2 lines or fewer), show stdout too for context
  const shouldShowStdout =
    hasStdout && (!hasStderr || stderrLines.length <= MINIMAL_INFO_THRESHOLD);

  // Use word wrapping for short outputs (4 lines or fewer) to show more detail
  const totalLines = stdoutLines.length + stderrLines.length;
  const shouldWrap = totalLines <= SHORT_OUTPUT_THRESHOLD;
  const wrapMode = shouldWrap ? 'wrap' : 'truncate-end';

  // Show stderr in yellow only if execution failed, otherwise gray
  const stdoutColor =
    status === ExecutionStatus.Success ? Palette.DarkGray : Palette.Gray;
  const stderrColor =
    status === ExecutionStatus.Failed ? Palette.Yellow : Palette.Gray;

  return (
    <Box marginTop={1} marginLeft={5} flexDirection="column" width={MAX_WIDTH}>
      {shouldShowStdout &&
        stdoutLines.map((line, index) => (
          <Text key={`out-${index}`} color={stdoutColor} wrap={wrapMode}>
            {line}
          </Text>
        ))}
      {stderrLines.map((line, index) => (
        <Text key={`err-${index}`} color={stderrColor} wrap={wrapMode}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
