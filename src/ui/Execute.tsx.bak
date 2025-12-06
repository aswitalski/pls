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
import { replacePlaceholders } from '../services/placeholder-resolver.js';
import { loadUserConfig } from '../services/config-loader.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';

const MINIMUM_PROCESSING_TIME = 400;

const STATUS_ICONS: Record<ExecutionStatus, string> = {
  [ExecutionStatus.Pending]: '- ',
  [ExecutionStatus.Running]: '• ',
  [ExecutionStatus.Success]: '✓ ',
  [ExecutionStatus.Failed]: '✗ ',
  [ExecutionStatus.Aborted]: '⊘ ',
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

function calculateTotalElapsed(commandStatuses: CommandState[]): number {
  return commandStatuses.reduce((sum, cmd) => {
    if (cmd.elapsed !== undefined) {
      return sum + cmd.elapsed;
    }
    if (cmd.startTime) {
      const elapsed = cmd.endTime
        ? cmd.endTime - cmd.startTime
        : Date.now() - cmd.startTime;
      return sum + elapsed;
    }
    return sum;
  }, 0);
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
    case ExecutionStatus.Aborted:
      return {
        icon: Palette.DarkOrange,
        description: getTextColor(true),
        command: Palette.DarkOrange,
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
  isActive = true,
  service,
  handlers,
}: ExecuteProps) {
  // isActive passed as prop
  const [error, setError] = useState<string | null>(state?.error ?? null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandStatuses, setCommandStatuses] = useState<CommandState[]>(
    (state?.commandStatuses as CommandState[]) ?? []
  );
  const [message, setMessage] = useState<string>(state?.message ?? '');
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const [outputs, setOutputs] = useState<CommandOutput[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);

  // Derive loading state from current conditions
  const isLoading =
    isActive &&
    commandStatuses.length === 0 &&
    !error &&
    !isExecuting &&
    !hasProcessed;

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting) && isActive) {
        setIsExecuting(false);
        setRunningIndex(null);
        // Mark any running command as aborted when cancelled
        const now = Date.now();
        setCommandStatuses((prev) => {
          const updated = prev.map((item) => {
            if (item.status === ExecutionStatus.Running) {
              const elapsed = item.startTime
                ? Math.floor((now - item.startTime) / 1000) * 1000
                : undefined;
              return {
                ...item,
                status: ExecutionStatus.Aborted,
                endTime: now,
                elapsed,
              };
            }
            return item;
          });

          // Save state after updating
          handlers?.updateState({
            commandStatuses: updated,
            message,
          });

          return updated;
        });

        handlers?.onAborted('execution');
      }
    },
    { isActive: (isLoading || isExecuting) && isActive }
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

    // Save state before completing
    handlers?.updateState({
      message,
      commandStatuses,
      error,
    });

    handlers?.completeActive();
  }, [isExecuting, commandStatuses, outputs, handlers, message, error]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (!service) {
      setError('No service available');
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        // Load user config for placeholder resolution
        const userConfig = loadUserConfig();

        // Format tasks for the execute tool and resolve placeholders
        const taskDescriptions = tasks
          .map((task) => {
            // Resolve placeholders in task action
            const resolvedAction = replacePlaceholders(task.action, userConfig);

            const params = task.params
              ? ` (params: ${JSON.stringify(task.params)})`
              : '';
            return `- ${resolvedAction}${params}`;
          })
          .join('\n');

        // Call execute tool to get commands
        const result = await svc!.processWithTool(taskDescriptions, 'execute');

        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (!mounted) return;

        if (!result.commands || result.commands.length === 0) {
          setOutputs([]);
          setHasProcessed(true);

          // Save state before completing
          handlers?.updateState({
            message: result.message,
            commandStatuses: [],
          });

          handlers?.completeActive();
          return;
        }

        // Resolve placeholders in command strings before execution
        const resolvedCommands = result.commands.map((cmd) => ({
          ...cmd,
          command: replacePlaceholders(cmd.command, userConfig),
        }));

        // Set message and initialize command statuses
        setMessage(result.message);
        setCommandStatuses(
          resolvedCommands.map((cmd, index) => ({
            command: cmd,
            status: ExecutionStatus.Pending,
            label: tasks[index]?.action,
          }))
        );

        setIsExecuting(true);

        // Execute commands sequentially
        const outputs = await executeCommands(
          resolvedCommands,
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
        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setIsExecuting(false);
          setError(errorMessage);
          setHasProcessed(true);

          // Save error state
          handlers?.updateState({
            error: errorMessage,
          });

          handlers?.onError(errorMessage);
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [tasks, isActive, service, handlers]);

  // Return null only when loading completes with no commands
  if (!isActive && commandStatuses.length === 0 && !error) {
    return null;
  }

  // Show completed steps when not active
  const showCompletedSteps = !isActive && commandStatuses.length > 0;

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Preparing commands. </Text>
          <Spinner />
        </Box>
      )}

      {(isExecuting || showCompletedSteps) && (
        <Box flexDirection="column" marginLeft={1}>
          {message && (
            <Box marginBottom={1}>
              <Text color={getTextColor(isActive)}>{message}</Text>
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
