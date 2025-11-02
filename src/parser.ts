/**
 * Parses a comma-separated list of tasks from command-line prompt
 * Strips exclamation marks and periods from each task
 *
 * @param prompt - Raw command-line input string
 * @returns Array of parsed task strings
 */
export function parseCommands(prompt: string): string[] {
  return prompt
    .split(',')
    .map(task => task
      .trim()
      .replace(/[!.]/g, '')
      .trim()
    )
    .filter(task => task.length > 0);
}
