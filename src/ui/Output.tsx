import React from 'react';
import { Box, Text } from 'ink';

import { Palette } from '../services/colors.js';
import { ExecutionStatus } from '../services/shell.js';

const MAX_LINES = 8;
const MAX_WIDTH = 75;
const SHORT_OUTPUT_THRESHOLD = 4;
const MINIMAL_INFO_THRESHOLD = 2;

export interface OutputProps {
  stdout: string;
  stderr: string;
  status: ExecutionStatus;
  isFinished?: boolean;
}

interface OutputDisplayConfig {
  stdoutLines: string[];
  stderrLines: string[];
  showStdout: boolean;
  wrapMode: 'wrap' | 'truncate-end';
  stdoutColor: string;
  stderrColor: string;
}

/**
 * Get the last N lines from text, filtering out empty/whitespace-only lines
 */
export function getLastLines(
  text: string,
  maxLines: number = MAX_LINES
): string[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  return lines.length <= maxLines ? lines : lines.slice(-maxLines);
}

/**
 * Compute display configuration for output rendering.
 * Encapsulates the logic for what to show and how to style it.
 */
export function computeDisplayConfig(
  stdout: string,
  stderr: string,
  status: ExecutionStatus,
  isFinished: boolean
): OutputDisplayConfig | null {
  const hasStdout = stdout.trim().length > 0;
  const hasStderr = stderr.trim().length > 0;

  if (!hasStdout && !hasStderr) return null;

  const stdoutLines = hasStdout ? getLastLines(stdout) : [];
  const stderrLines = hasStderr ? getLastLines(stderr) : [];

  // Show stdout if no stderr, or if stderr is minimal (provides context)
  const showStdout =
    hasStdout && (!hasStderr || stderrLines.length <= MINIMAL_INFO_THRESHOLD);

  // Use word wrapping for short outputs to show more detail
  const totalLines = stdoutLines.length + stderrLines.length;
  const wrapMode =
    totalLines <= SHORT_OUTPUT_THRESHOLD ? 'wrap' : 'truncate-end';

  // Darker colors for finished tasks
  const baseColor = isFinished ? Palette.DarkGray : Palette.Gray;
  const stderrColor =
    status === ExecutionStatus.Failed ? Palette.Yellow : baseColor;

  return {
    stdoutLines,
    stderrLines,
    showStdout,
    wrapMode,
    stdoutColor: baseColor,
    stderrColor,
  };
}

export function Output({ stdout, stderr, status, isFinished }: OutputProps) {
  const config = computeDisplayConfig(
    stdout,
    stderr,
    status,
    isFinished ?? false
  );

  if (!config) return null;

  const {
    stdoutLines,
    stderrLines,
    showStdout,
    wrapMode,
    stdoutColor,
    stderrColor,
  } = config;

  return (
    <Box marginTop={1} marginLeft={5} flexDirection="column" width={MAX_WIDTH}>
      {showStdout &&
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
