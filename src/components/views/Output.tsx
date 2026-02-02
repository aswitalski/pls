import React from 'react';
import { Box, Text } from 'ink';

import { Palette } from '../../services/colors.js';
import { ExecutionStatus } from '../../services/shell.js';
import { OutputChunk, OutputSource } from '../../types/components.js';

const MAX_LINES = 8;
const MAX_WIDTH = 75;
const INCOMPLETE_LINE_DELAY = 3000;

/**
 * Determine if an incomplete line should be shown.
 * Shows incomplete lines if they are older than the delay threshold.
 */
function shouldShowIncompleteLine(lastChunk: OutputChunk): boolean {
  return Date.now() - lastChunk.timestamp >= INCOMPLETE_LINE_DELAY;
}

export interface OutputProps {
  chunks: OutputChunk[];
  status: ExecutionStatus;
  isFinished?: boolean;
}

export interface OutputDisplayConfig {
  rows: string[];
  color: string;
}

/**
 * Split a line into chunks of maxWidth characters.
 */
function splitIntoRows(line: string, maxWidth: number): string[] {
  if (line.length <= maxWidth) return [line];
  const rows: string[] = [];
  for (let i = 0; i < line.length; i += maxWidth) {
    rows.push(line.slice(i, i + maxWidth));
  }
  return rows;
}

/**
 * Process text into terminal rows.
 * Handles carriage returns and splits long lines into chunks.
 */
function textToRows(text: string, maxWidth: number): string[] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      // Handle carriage returns: keep only content after the last \r
      const lastCR = line.lastIndexOf('\r');
      return lastCR >= 0 ? line.slice(lastCR + 1) : line;
    })
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => splitIntoRows(line, maxWidth));
}

/**
 * Get the last N terminal rows from text.
 * Splits long lines into chunks of maxWidth characters, then takes the last N.
 * Handles carriage returns used in progress output by keeping only the
 * content after the last \r in each line.
 */
export function getLastLines(
  text: string,
  maxLines: number = MAX_LINES,
  maxWidth: number = MAX_WIDTH
): string[] {
  const rows = textToRows(text, maxWidth);
  return rows.length <= maxLines ? rows : rows.slice(-maxLines);
}

/**
 * Convert output chunks to terminal rows.
 * Sorts by timestamp, combines text, deduplicates adjacent lines.
 * When not finished, only shows complete lines (ending with newline),
 * unless the last chunk is older than INCOMPLETE_LINE_DELAY.
 */
export function chunksToRows(
  chunks: OutputChunk[],
  maxLines: number = MAX_LINES,
  maxWidth: number = MAX_WIDTH,
  isFinished: boolean = true
): string[] {
  if (chunks.length === 0) return [];

  // Separate output and stdin chunks
  const outputChunks = chunks
    .filter((c) => c.source !== OutputSource.Stdin)
    .sort((a, b) => a.timestamp - b.timestamp);
  const stdinChunks = chunks
    .filter((c) => c.source === OutputSource.Stdin)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Build output text and track cumulative positions for each chunk
  let outputText = '';
  const chunkEndPositions: { timestamp: number; endPos: number }[] = [];
  for (const chunk of outputChunks) {
    outputText += chunk.text;
    chunkEndPositions.push({
      timestamp: chunk.timestamp,
      endPos: outputText.length,
    });
  }

  // Insert stdin chunks after the last newline that existed before each stdin's timestamp
  let combined = outputText;
  let insertOffset = 0;

  for (const stdin of stdinChunks) {
    // Find how much output text existed before this stdin's timestamp
    let textPositionAtStdin = 0;
    for (const pos of chunkEndPositions) {
      if (pos.timestamp <= stdin.timestamp) {
        textPositionAtStdin = pos.endPos;
      } else {
        break;
      }
    }
    textPositionAtStdin += insertOffset;

    // Find the last newline in text up to this position
    const textBeforeStdin = combined.slice(0, textPositionAtStdin);
    const lastNewline = textBeforeStdin.lastIndexOf('\n');

    // Insert stdin after the last newline (or at start if no newline)
    const insertPos = lastNewline >= 0 ? lastNewline + 1 : 0;

    // Remove leading \n from stdin if we're already at a line boundary
    let stdinText = stdin.text;
    if (lastNewline >= 0 && stdinText.startsWith('\n')) {
      stdinText = stdinText.slice(1);
    }

    combined =
      combined.slice(0, insertPos) + stdinText + combined.slice(insertPos);
    insertOffset += stdinText.length;
  }

  // When not finished, only show complete lines (strip trailing incomplete line)
  // unless the last chunk is old enough to be shown
  if (!isFinished && !combined.endsWith('\n') && outputChunks.length > 0) {
    const lastOutputChunk = outputChunks[outputChunks.length - 1];
    if (!shouldShowIncompleteLine(lastOutputChunk)) {
      const lastNewline = combined.lastIndexOf('\n');
      if (lastNewline >= 0) {
        combined = combined.slice(0, lastNewline + 1);
      } else {
        // No complete lines yet
        return [];
      }
    }
  }

  // Convert to rows
  const rows = textToRows(combined, maxWidth);

  // Deduplicate adjacent identical lines
  const deduplicated = rows.filter(
    (row, index) => index === 0 || row !== rows[index - 1]
  );

  return deduplicated.length <= maxLines
    ? deduplicated
    : deduplicated.slice(-maxLines);
}

/**
 * Compute display configuration for output rendering.
 */
export function computeDisplayConfig(
  chunks: OutputChunk[],
  status: ExecutionStatus,
  isFinished: boolean
): OutputDisplayConfig | null {
  if (chunks.length === 0) return null;

  const rows = chunksToRows(chunks, MAX_LINES, MAX_WIDTH, isFinished);
  if (rows.length === 0) return null;

  // Use yellow for failed status, otherwise gray (darker if finished)
  const baseColor = isFinished ? Palette.DarkGray : Palette.Gray;
  const color = status === ExecutionStatus.Failed ? Palette.Yellow : baseColor;

  return { rows, color };
}

export function Output({ chunks, status, isFinished }: OutputProps) {
  const config = computeDisplayConfig(chunks, status, isFinished ?? false);

  if (!config) return null;

  const { rows, color } = config;

  return (
    <Box marginTop={1} marginLeft={5} flexDirection="column" width={MAX_WIDTH}>
      {rows.map((row, index) => (
        <Text key={index} color={color} wrap="truncate">
          {row}
        </Text>
      ))}
    </Box>
  );
}
