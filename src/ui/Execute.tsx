import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { ExecuteProps } from '../types/components.js';

import { ExecuteCommand } from '../services/anthropic.js';
import { Colors, getTextColor, Palette } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { formatDuration } from '../services/utils.js';
import {
  CommandOutput,
  ExecutionProgress,
  ExecutionStatus,
  executeCommands,
} from '../services/shell.js';

import { Spinner } from './Spinner.js';

const MINIMUM_PROCESSING_TIME = 400;

const STATUS_ICONS: Record<ExecutionStatus, string> = {
  [ExecutionStatus.Pending]: '- ',
  [ExecutionStatus.Running]: '• ',
  [ExecutionStatus.Success]: '✓ ',
  [ExecutionStatus.Failed]: '✗ ',
};

interface CommandState {
  label: string;
  command: ExecuteCommand;
  status: ExecutionStatus;
  output?: CommandOutput;
  startTime?: number;
  endTime?: number;
  elapsed?: number;
}

function getStatusColors(status: ExecutionStatus) {
  switch (status) {
    case ExecutionStatus.Pending:
      return {
        icon: Palette.Gray,
        description: Palette.Gray,
        command: Palette.DarkGray,
        symbol: Palette.DarkGray,
      };
    case ExecutionStatus.Running:
      return {
        icon: Palette.Gray,
        description: getTextColor(true),
        command: Palette.LightGreen,
        symbol: Palette.AshGray,
      };
    case ExecutionStatus.Success:
      return {
        icon: Colors.Status.Success,
        description: getTextColor(true),
        command: Palette.Gray,
        symbol: Palette.Gray,
      };
    case ExecutionStatus.Failed:
      return {
        icon: Colors.Status.Error,
        description: Colors.Status.Error,
        command: Colors.Status.Error,
        symbol: Palette.Gray,
      };
  }
}

interface CommandStatusDisplayProps {
  item: CommandState;
  elapsed?: number;
}

function CommandStatusDisplay({ item, elapsed }: CommandStatusDisplayProps) {
  const colors = getStatusColors(item.status);

  const getElapsedTime = () => {
    if (item.status === ExecutionStatus.Running && elapsed !== undefined) {
      return elapsed;
    } else if (item.startTime && item.endTime) {
      return item.endTime - item.startTime;
    }
    return undefined;
  };

  const elapsedTime = getElapsedTime();

  return (
    <Box flexDirection="column">
      <Box paddingLeft={2}>
        <Text color={colors.icon}>{STATUS_ICONS[item.status]}</Text>
        <Text color={colors.description}>
          {item.label || item.command.description}
        </Text>
        {elapsedTime !== undefined && (
          <Text color={Palette.DarkGray}> ({formatDuration(elapsedTime)})</Text>
        )}
      </Box>
      <Box paddingLeft={5}>
        <Text color={colors.symbol}>∟ </Text>
        <Text color={colors.command}>{item.command.command}</Text>
        {item.status === ExecutionStatus.Running && (
          <Text>
            {' '}
            <Spinner />
          </Text>
        )}
      </Box>
    </Box>
  );
}

export function Execute({
  tasks,
  state,
  service,
  onError,
  onComplete,
  onAborted,
}: ExecuteProps) {
  const done = state?.done ?? false;
  const isCurrent = done === false;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(state?.isLoading ?? !done);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandStatuses, setCommandStatuses] = useState<CommandState[]>([]);
  const [message, setMessage] = useState<string>('');
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const [outputs, setOutputs] = useState<CommandOutput[]>([]);

  useInput(
    (input, key) => {
      if (key.escape && (isLoading || isExecuting) && !done) {
        setIsLoading(false);
        setIsExecuting(false);
        onAborted();
      }
    },
    { isActive: (isLoading || isExecuting) && !done }
  );

  // Update elapsed time for running command
  useEffect(() => {
    if (runningIndex === null) return;

    const item = commandStatuses[runningIndex];
    if (!item?.startTime) return;

    const interval = setInterval(() => {
      setCurrentElapsed((prev) => {
        const next = Date.now() - item.startTime!;
        return next !== prev ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [runningIndex, commandStatuses]);

  // Handle completion callback when execution finishes
  useEffect(() => {
    if (isExecuting || commandStatuses.length === 0 || !outputs.length) return;

    // Sum up elapsed times from all commands
    const totalElapsed = commandStatuses.reduce(
      (sum, cmd) => sum + (cmd.elapsed ?? 0),
      0
    );

    onComplete?.(outputs, totalElapsed);
  }, [isExecuting, commandStatuses, outputs, onComplete]);

  useEffect(() => {
    if (done) {
      return;
    }

    if (!service) {
      setError('No service available');
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        // Format tasks for the execute tool
        const taskDescriptions = tasks
          .map((task) => {
            const params = task.params
              ? ` (params: ${JSON.stringify(task.params)})`
              : '';
            return `- ${task.action}${params}`;
          })
          .join('\n');

        // Call execute tool to get commands
        const result = await svc!.processWithTool(taskDescriptions, 'execute');
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MINIMUM_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (!mounted) return;

        if (!result.commands || result.commands.length === 0) {
          setIsLoading(false);
          setOutputs([]);
          onComplete?.([], 0);
          return;
        }

        // Set message and initialize command statuses
        setMessage(result.message);
        setCommandStatuses(
          result.commands.map((cmd, index) => ({
            command: cmd,
            status: ExecutionStatus.Pending,
            label: tasks[index]?.action,
          }))
        );

        setIsLoading(false);
        setIsExecuting(true);

        // Execute commands sequentially
        const outputs = await executeCommands(
          result.commands,
          (progress: ExecutionProgress) => {
            if (!mounted) return;

            const now = Date.now();

            setCommandStatuses((prev) =>
              prev.map((item, idx) => {
                if (idx === progress.currentIndex) {
                  const isStarting =
                    progress.status === ExecutionStatus.Running &&
                    !item.startTime;
                  const isEnding =
                    progress.status !== ExecutionStatus.Running &&
                    progress.status !== ExecutionStatus.Pending;

                  const endTime = isEnding ? now : item.endTime;
                  const elapsed =
                    isEnding && item.startTime
                      ? Math.floor((now - item.startTime) / 1000) * 1000
                      : item.elapsed;

                  return {
                    ...item,
                    status: progress.status,
                    output: progress.output,
                    startTime: isStarting ? now : item.startTime,
                    endTime,
                    elapsed,
                  };
                }
                return item;
              })
            );

            if (progress.status === ExecutionStatus.Running) {
              setRunningIndex((prev) =>
                prev !== progress.currentIndex ? progress.currentIndex : prev
              );
              setCurrentElapsed((prev) => (prev !== 0 ? 0 : prev));
            } else if (
              progress.status === ExecutionStatus.Success ||
              progress.status === ExecutionStatus.Failed
            ) {
              setRunningIndex((prev) => (prev !== null ? null : prev));
            }
          }
        );

        if (mounted) {
          setOutputs(outputs);
          setIsExecuting(false);
        }
      } catch (err) {
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, MINIMUM_PROCESSING_TIME - elapsed);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setIsLoading(false);
          setIsExecuting(false);
          if (onError) {
            onError(errorMessage);
          } else {
            setError(errorMessage);
          }
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [tasks, done, service, onComplete, onError]);

  // Return null only when loading completes with no commands
  if (done && commandStatuses.length === 0 && !error) {
    return null;
  }

  // Show completed steps when done
  const showCompletedSteps = done && commandStatuses.length > 0;

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box>
          <Text color={getTextColor(isCurrent)}>Preparing commands. </Text>
          <Spinner />
        </Box>
      )}

      {(isExecuting || showCompletedSteps) && (
        <Box flexDirection="column">
          {message && (
            <Box marginBottom={1}>
              <Text color={getTextColor(isCurrent)}>{message}</Text>
              {isExecuting && (
                <Text>
                  {' '}
                  <Spinner />
                </Text>
              )}
            </Box>
          )}

          {commandStatuses.map((item, index) => (
            <Box
              key={index}
              marginBottom={index < commandStatuses.length - 1 ? 1 : 0}
            >
              <CommandStatusDisplay
                item={item}
                elapsed={index === runningIndex ? currentElapsed : undefined}
              />
            </Box>
          ))}
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color={Colors.Status.Error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
