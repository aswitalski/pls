import { useCallback, useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import { ComponentStatus, ExecuteProps } from '../types/components.js';

import { ExecuteCommand } from '../services/anthropic.js';
import { Colors, getTextColor } from '../services/colors.js';
import { useInput } from '../services/keyboard.js';
import { formatErrorMessage } from '../services/messages.js';
import { CommandOutput } from '../services/shell.js';
import { replacePlaceholders } from '../services/resolver.js';
import { loadUserConfig } from '../services/loader.js';
import { ensureMinimumTime } from '../services/timing.js';

import { Spinner } from './Spinner.js';
import { Task } from './Task.js';

const MINIMUM_PROCESSING_TIME = 400;

interface TaskInfo {
  label: string;
  command: ExecuteCommand;
}

export function Execute({
  tasks,
  state,
  status,
  service,
  handlers,
}: ExecuteProps) {
  const isActive = status === ComponentStatus.Active;
  const [error, setError] = useState<string | null>(state?.error ?? null);
  const [taskInfos, setTaskInfos] = useState<TaskInfo[]>(
    (state?.taskInfos as TaskInfo[]) ?? []
  );
  const [message, setMessage] = useState<string>(state?.message ?? '');
  const [activeTaskIndex, setActiveTaskIndex] = useState<number>(
    state?.activeTaskIndex ?? -1
  );
  const [hasProcessed, setHasProcessed] = useState(false);

  // Derive loading state from current conditions
  const isLoading =
    isActive && taskInfos.length === 0 && !error && !hasProcessed;

  const isExecuting =
    activeTaskIndex >= 0 && activeTaskIndex < taskInfos.length;

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting) && isActive) {
        // Cancel execution
        setActiveTaskIndex(-1);
        handlers?.onAborted('execution');
      }
    },
    { isActive: (isLoading || isExecuting) && isActive }
  );

  // Process tasks to get commands from AI
  useEffect(() => {
    if (!isActive || taskInfos.length > 0 || hasProcessed) {
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
          setHasProcessed(true);
          handlers?.updateState({
            message: result.message,
            taskInfos: [],
          });
          handlers?.completeActive();
          return;
        }

        // Resolve placeholders in command strings
        const resolvedCommands = result.commands.map((cmd) => ({
          ...cmd,
          command: replacePlaceholders(cmd.command, userConfig),
        }));

        // Set message and create task infos
        setMessage(result.message);
        const infos = resolvedCommands.map((cmd, index) => ({
          label: tasks[index]?.action,
          command: cmd,
        }));
        setTaskInfos(infos);
        setActiveTaskIndex(0); // Start with first task
      } catch (err) {
        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);
          setHasProcessed(true);
          handlers?.updateState({ error: errorMessage });
          handlers?.onError(errorMessage);
        }
      }
    }

    process(service);

    return () => {
      mounted = false;
    };
  }, [tasks, isActive, service, handlers, taskInfos.length, hasProcessed]);

  // Handle task completion - move to next task
  const handleTaskComplete = useCallback(
    (index: number, _output: CommandOutput) => {
      if (index < taskInfos.length - 1) {
        // More tasks to execute
        setActiveTaskIndex(index + 1);
      } else {
        // All tasks complete
        setActiveTaskIndex(-1);
        handlers?.updateState({
          message,
          taskInfos,
          activeTaskIndex: -1,
        });
        handlers?.completeActive();
      }
    },
    [taskInfos, message, handlers]
  );

  const handleTaskError = useCallback(
    (error: string) => {
      // Stop execution on error
      setActiveTaskIndex(-1);
      setError(error);
      handlers?.updateState({
        message,
        taskInfos,
        activeTaskIndex: -1,
        error,
      });
      handlers?.onError(error);
    },
    [taskInfos, message, handlers]
  );

  // Return null only when loading completes with no commands
  if (!isActive && taskInfos.length === 0 && !error) {
    return null;
  }

  // Show completed steps when not active
  const showTasks = !isActive && taskInfos.length > 0;

  return (
    <Box alignSelf="flex-start" flexDirection="column">
      {isLoading && (
        <Box marginLeft={1}>
          <Text color={getTextColor(isActive)}>Preparing commands. </Text>
          <Spinner />
        </Box>
      )}

      {(isExecuting || showTasks) && (
        <Box flexDirection="column" marginLeft={1}>
          {message && (
            <Box marginBottom={1} gap={1}>
              <Text color={getTextColor(isActive)}>{message}</Text>
              {isExecuting && <Spinner />}
            </Box>
          )}

          {taskInfos.map((taskInfo, index) => (
            <Box
              key={index}
              marginBottom={index < taskInfos.length - 1 ? 1 : 0}
            >
              <Task
                label={taskInfo.label}
                command={taskInfo.command}
                isActive={isActive && index === activeTaskIndex}
                index={index}
                onComplete={handleTaskComplete}
                onError={handleTaskError}
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
