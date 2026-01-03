import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  ComponentStatus,
  ExecuteProps,
  ExecuteState,
  TaskData,
  TaskOutput,
} from '../../types/components.js';

import { useInput } from '../../services/keyboard.js';
import {
  formatErrorMessage,
  getExecutionErrorMessage,
} from '../../services/messages.js';
import { ExecutionStatus } from '../../services/shell.js';
import {
  ELAPSED_UPDATE_INTERVAL,
  ensureMinimumTime,
} from '../../services/timing.js';

import {
  handleTaskCompletion,
  handleTaskFailure,
} from '../../execution/handlers.js';
import { processTasks } from '../../execution/processing.js';
import { executeReducer, initialState } from '../../execution/reducer.js';
import { executeTask } from '../../execution/runner.js';
import { ExecuteActionType } from '../../execution/types.js';
import { getCurrentTaskIndex } from '../../execution/utils.js';
import { createMessage } from '../../services/components.js';

import { ExecuteView } from '../views/Execute.js';

export {
  ExecuteView,
  ExecuteViewProps,
  mapStateToViewProps,
} from '../views/Execute.js';

const MINIMUM_PROCESSING_TIME = 400;

/**
 * Create an ExecuteState with defaults
 */
function createExecuteState(
  overrides: Partial<ExecuteState> = {}
): ExecuteState {
  return {
    message: '',
    summary: '',
    tasks: [],
    completionMessage: null,
    error: null,
    ...overrides,
  };
}

/**
 * Execute controller: Runs tasks sequentially and manages all execution state
 */
export function Execute({
  tasks: inputTasks,
  status,
  service,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: ExecuteProps) {
  const isActive = status === ComponentStatus.Active;
  const [localState, dispatch] = useReducer(executeReducer, initialState);

  // Track working directory across commands (persists cd changes)
  const workdirRef = useRef<string | undefined>(undefined);

  // Ref to collect live output during execution (dispatched every second)
  const outputRef = useRef<TaskOutput>({ stdout: '', stderr: '' });

  // Ref to track if current task execution is cancelled
  const cancelledRef = useRef(false);

  const { error, tasks, message, hasProcessed, completionMessage, summary } =
    localState;

  // Derive current task index from tasks
  const currentTaskIndex = getCurrentTaskIndex(tasks);

  // Derive states
  const isLoading = isActive && tasks.length === 0 && !error && !hasProcessed;
  const isExecuting = isActive && currentTaskIndex < tasks.length;
  const showTasks = !isActive && tasks.length > 0;

  // Get current running task for progress updates
  const runningTask = tasks.find((t) => t.status === ExecutionStatus.Running);

  // Update reducer with progress every second while task is running
  useEffect(() => {
    if (!runningTask?.startTime || !isExecuting) return;

    const taskStartTime = runningTask.startTime;
    const interval = setInterval(() => {
      const elapsed = Date.now() - taskStartTime;
      dispatch({
        type: ExecuteActionType.TaskProgress,
        payload: {
          index: currentTaskIndex,
          elapsed,
          output: {
            stdout: outputRef.current.stdout,
            stderr: outputRef.current.stderr,
          },
        },
      });
    }, ELAPSED_UPDATE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [runningTask?.startTime, isExecuting, currentTaskIndex]);

  // Handle cancel - state already in reducer, just need to update final output
  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    dispatch({ type: ExecuteActionType.CancelExecution });

    // Build final state with current output for the running task
    const updatedTasks = tasks.map((task) => {
      if (task.status === ExecutionStatus.Running) {
        return {
          ...task,
          status: ExecutionStatus.Aborted,
          output: {
            stdout: outputRef.current.stdout,
            stderr: outputRef.current.stderr,
          },
        };
      } else if (task.status === ExecutionStatus.Pending) {
        return { ...task, status: ExecutionStatus.Cancelled };
      }
      return task;
    });

    const finalState = createExecuteState({
      message,
      summary,
      tasks: updatedTasks,
    });
    requestHandlers.onCompleted(finalState);
    requestHandlers.onAborted('execution');
  }, [message, summary, tasks, requestHandlers]);

  useInput(
    (_, key) => {
      if (key.escape && (isLoading || isExecuting)) {
        handleCancel();
      }
    },
    { isActive: (isLoading || isExecuting) && isActive }
  );

  // Process tasks to get commands from AI
  useEffect(() => {
    if (!isActive || tasks.length > 0 || hasProcessed) {
      return;
    }

    let mounted = true;

    async function process(svc: typeof service) {
      const startTime = Date.now();

      try {
        const result = await processTasks(inputTasks, svc);

        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (!mounted) return;

        // Add debug components to timeline if present
        if (result.debug?.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }

        if (result.commands.length === 0) {
          if (result.error) {
            const errorMessage = getExecutionErrorMessage(result.error);
            workflowHandlers.addToTimeline(
              createMessage({ text: errorMessage }, ComponentStatus.Done)
            );
            requestHandlers.onCompleted(
              createExecuteState({ message: result.message })
            );
            lifecycleHandlers.completeActive();
            return;
          }

          dispatch({
            type: ExecuteActionType.ProcessingComplete,
            payload: { message: result.message },
          });
          requestHandlers.onCompleted(
            createExecuteState({ message: result.message })
          );
          lifecycleHandlers.completeActive();
          return;
        }

        // Create task data from commands
        const tasks = result.commands.map(
          (cmd, index) =>
            ({
              label: inputTasks[index]?.action ?? cmd.description,
              command: cmd,
              status: ExecutionStatus.Pending,
              elapsed: 0,
              output: null,
            }) as TaskData
        );

        dispatch({
          type: ExecuteActionType.CommandsReady,
          payload: {
            message: result.message,
            summary: result.summary,
            tasks,
          },
        });

        requestHandlers.onCompleted(
          createExecuteState({
            message: result.message,
            summary: result.summary,
            tasks,
          })
        );
      } catch (err) {
        await ensureMinimumTime(startTime, MINIMUM_PROCESSING_TIME);

        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          dispatch({
            type: ExecuteActionType.ProcessingError,
            payload: { error: errorMessage },
          });
          requestHandlers.onCompleted(
            createExecuteState({ error: errorMessage })
          );
          requestHandlers.onError(errorMessage);
        }
      }
    }

    void process(service);

    return () => {
      mounted = false;
    };
  }, [
    inputTasks,
    isActive,
    service,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
    tasks.length,
    hasProcessed,
  ]);

  // Execute current task
  useEffect(() => {
    if (
      !isActive ||
      tasks.length === 0 ||
      currentTaskIndex >= tasks.length ||
      error
    ) {
      return;
    }

    const currentTask = tasks[currentTaskIndex];
    if (currentTask.status !== ExecutionStatus.Pending) {
      return;
    }

    cancelledRef.current = false;

    // Mark task as started (running)
    dispatch({
      type: ExecuteActionType.TaskStarted,
      payload: { index: currentTaskIndex, startTime: Date.now() },
    });

    // Reset output ref for new task
    outputRef.current = { stdout: '', stderr: '' };

    // Merge workdir into command
    const command = workdirRef.current
      ? { ...currentTask.command, workdir: workdirRef.current }
      : currentTask.command;

    void executeTask(command, currentTaskIndex, {
      onUpdate: (output) => {
        if (!cancelledRef.current) {
          outputRef.current = { stdout: output.stdout, stderr: output.stderr };
        }
      },
      onComplete: (elapsed, execOutput) => {
        if (cancelledRef.current) return;

        // Track working directory
        if (execOutput.workdir) {
          workdirRef.current = execOutput.workdir;
        }

        const tasksWithOutput = tasks.map((task, i) =>
          i === currentTaskIndex
            ? {
                ...task,
                output: {
                  stdout: execOutput.stdout,
                  stderr: execOutput.stderr,
                },
              }
            : task
        );

        const result = handleTaskCompletion(currentTaskIndex, elapsed, {
          tasks: tasksWithOutput,
          message,
          summary,
        });

        dispatch(result.action);
        requestHandlers.onCompleted(result.finalState);

        if (result.shouldComplete) {
          lifecycleHandlers.completeActive();
        }
      },
      onError: (errorMsg, execOutput) => {
        if (cancelledRef.current) return;

        // Track working directory
        if (execOutput.workdir) {
          workdirRef.current = execOutput.workdir;
        }

        const tasksWithOutput = tasks.map((task, i) =>
          i === currentTaskIndex
            ? {
                ...task,
                output: {
                  stdout: execOutput.stdout,
                  stderr: execOutput.stderr,
                },
                error: execOutput.error || undefined,
              }
            : task
        );

        const result = handleTaskFailure(currentTaskIndex, errorMsg, {
          tasks: tasksWithOutput,
          message,
          summary,
        });

        dispatch(result.action);
        requestHandlers.onCompleted(result.finalState);

        const errorMessage = getExecutionErrorMessage(errorMsg);
        requestHandlers.onError(errorMessage);
      },
    });
  }, [
    isActive,
    tasks,
    currentTaskIndex,
    message,
    summary,
    error,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  ]);

  return (
    <ExecuteView
      isLoading={isLoading}
      isExecuting={isExecuting}
      isActive={isActive}
      error={error}
      message={message}
      tasks={tasks}
      completionMessage={completionMessage}
      showTasks={showTasks}
    />
  );
}
