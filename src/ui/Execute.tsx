import { useCallback, useEffect, useState } from 'react';
import { Box, Text } from 'ink';

import {
  ComponentStatus,
  ExecuteProps,
  TaskInfo,
} from '../types/components.js';

import { ExecuteCommand } from '../services/anthropic.js';
import { Colors, getTextColor } from '../services/colors.js';
import { addDebugToTimeline } from '../services/components.js';
import { useInput } from '../services/keyboard.js';
import { loadUserConfig } from '../services/loader.js';
import { formatErrorMessage } from '../services/messages.js';
import { replacePlaceholders } from '../services/resolver.js';
import { CommandOutput, ExecutionStatus } from '../services/shell.js';
import { ensureMinimumTime } from '../services/timing.js';
import { formatDuration } from '../services/utils.js';

import { Spinner } from './Spinner.js';
import { Task } from './Task.js';

const MINIMUM_PROCESSING_TIME = 400;

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
    state?.taskInfos ?? []
  );
  const [message, setMessage] = useState<string>(state?.message ?? '');
  const [completed, setCompleted] = useState<number>(state?.completed ?? 0);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [taskExecutionTimes, setTaskExecutionTimes] = useState<number[]>(
    state?.taskExecutionTimes ?? []
  );
  const [completionMessage, setCompletionMessage] = useState<string | null>(
    state?.completionMessage ?? null
  );
  const [summary, setSummary] = useState<string>(state?.summary ?? '');

  // Derive loading state from current conditions
  const isLoading =
    isActive && taskInfos.length === 0 && !error && !hasProcessed;

  const isExecuting = completed < taskInfos.length;

  // Handle cancel with useCallback to ensure we capture latest state
  const handleCancel = useCallback(() => {
    // Mark tasks based on their status relative to completed:
    // - Before completed: finished (Success)
    // - At completed: interrupted (Aborted)
    // - After completed: never started (Cancelled)
    const updatedTaskInfos = taskInfos.map((task, taskIndex) => {
      if (taskIndex < completed) {
        // Tasks that completed before interruption
        return { ...task, status: ExecutionStatus.Success };
      } else if (taskIndex === completed) {
        // Task that was running when interrupted
        return { ...task, status: ExecutionStatus.Aborted };
      } else {
        // Tasks that haven't started yet
        return { ...task, status: ExecutionStatus.Cancelled };
      }
    });

    setTaskInfos(updatedTaskInfos);
    handlers?.updateState({
      message,
      taskInfos: updatedTaskInfos,
      completed,
      taskExecutionTimes,
    });
    handlers?.onAborted('execution');
  }, [message, taskInfos, completed, taskExecutionTimes, handlers]);

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting) && isActive) {
        handleCancel();
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

        // Add debug components to timeline if present
        addDebugToTimeline(result.debug, handlers);

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

        // Set message, summary, and create task infos
        const newMessage = result.message;
        const newSummary = result.summary || '';
        const infos = resolvedCommands.map((cmd, index) => ({
          label: tasks[index]?.action,
          command: cmd,
        }));

        setMessage(newMessage);
        setSummary(newSummary);
        setTaskInfos(infos);
        setCompleted(0); // Start with first task

        // Update state after AI processing
        handlers?.updateState({
          message: newMessage,
          summary: newSummary,
          taskInfos: infos,
          completed: 0,
          taskExecutionTimes: [],
          completionMessage: null,
          error: null,
        });
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
    (index: number, _output: CommandOutput, elapsed: number) => {
      const updatedTimes = [...taskExecutionTimes, elapsed];
      setTaskExecutionTimes(updatedTimes);

      // Update task with elapsed time and success status
      const updatedTaskInfos = taskInfos.map((task, i) =>
        i === index
          ? { ...task, status: ExecutionStatus.Success, elapsed }
          : task
      );
      setTaskInfos(updatedTaskInfos);

      if (index < taskInfos.length - 1) {
        // More tasks to execute
        setCompleted(index + 1);
        handlers?.updateState({
          message,
          summary,
          taskInfos: updatedTaskInfos,
          completed: index + 1,
          taskExecutionTimes: updatedTimes,
          completionMessage: null,
          error: null,
        });
      } else {
        // All tasks complete
        const totalElapsed = updatedTimes.reduce((sum, time) => sum + time, 0);
        const summaryText = summary?.trim() || 'Execution completed';
        const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;
        setCompletionMessage(completion);
        handlers?.updateState({
          message,
          summary,
          taskInfos: updatedTaskInfos,
          completed: index + 1,
          taskExecutionTimes: updatedTimes,
          completionMessage: completion,
          error: null,
        });
        handlers?.completeActive();
      }
    },
    [taskInfos, message, handlers, taskExecutionTimes, summary]
  );

  const handleTaskError = useCallback(
    (index: number, error: string, elapsed: number) => {
      const task = taskInfos[index];
      const isCritical = task?.command.critical !== false; // Default to true

      // Update task with elapsed time and failed status
      const updatedTaskInfos = taskInfos.map((task, i) =>
        i === index
          ? { ...task, status: ExecutionStatus.Failed, elapsed }
          : task
      );
      setTaskInfos(updatedTaskInfos);

      if (isCritical) {
        // Critical failure - stop execution
        setError(error);
        handlers?.updateState({
          message,
          summary,
          taskInfos: updatedTaskInfos,
          completed: index + 1,
          taskExecutionTimes,
          completionMessage: null,
          error,
        });
        handlers?.onError(error);
      } else {
        // Non-critical failure - continue to next task
        const updatedTimes = [...taskExecutionTimes, elapsed];
        setTaskExecutionTimes(updatedTimes);

        if (index < taskInfos.length - 1) {
          setCompleted(index + 1);
          handlers?.updateState({
            message,
            summary,
            taskInfos: updatedTaskInfos,
            completed: index + 1,
            taskExecutionTimes: updatedTimes,
            completionMessage: null,
            error: null,
          });
        } else {
          // Last task, complete execution
          const totalElapsed = updatedTimes.reduce(
            (sum, time) => sum + time,
            0
          );
          const summaryText = summary?.trim() || 'Execution completed';
          const completion = `${summaryText} in ${formatDuration(totalElapsed)}.`;
          setCompletionMessage(completion);
          handlers?.updateState({
            message,
            summary,
            taskInfos: updatedTaskInfos,
            completed: index + 1,
            taskExecutionTimes: updatedTimes,
            completionMessage: completion,
            error: null,
          });
          handlers?.completeActive();
        }
      }
    },
    [taskInfos, message, handlers, taskExecutionTimes, summary]
  );

  const handleTaskAbort = useCallback(
    (_index: number) => {
      // Task was aborted - execution already stopped by Escape handler
      // Just update state, don't call onAborted (already called at Execute level)
      handlers?.updateState({
        message,
        taskInfos,
        completed,
      });
    },
    [taskInfos, message, completed, handlers]
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
                isActive={isActive && index === completed}
                index={index}
                initialStatus={taskInfo.status}
                initialElapsed={taskInfo.elapsed}
                onComplete={handleTaskComplete}
                onAbort={handleTaskAbort}
                onError={handleTaskError}
              />
            </Box>
          ))}
        </Box>
      )}

      {completionMessage && !isActive && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={getTextColor(false)}>{completionMessage}</Text>
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
