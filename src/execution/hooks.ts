import {
  Dispatch,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ComponentDefinition,
  ComponentStatus,
  ExecuteState,
  LifecycleHandlers,
  RequestHandlers,
  TaskInfo,
  WorkflowHandlers,
} from '../types/components.js';
import { FeedbackType, Task } from '../types/types.js';

import { LLMService } from '../services/anthropic.js';
import { createFeedback, createMessage } from '../services/components.js';
import {
  formatErrorMessage,
  getExecutionErrorMessage,
} from '../services/messages.js';
import { ExecutionStatus } from '../services/shell.js';
import { ensureMinimumTime } from '../services/timing.js';

import { handleTaskCompletion, handleTaskFailure } from './handlers.js';
import { processTasks } from './processing.js';
import { executeTask, TaskOutput } from './runner.js';
import { ExecuteAction, ExecuteActionType } from './types.js';
import { getCurrentTaskIndex } from './utils.js';

const ELAPSED_UPDATE_INTERVAL = 1000;

/**
 * Track elapsed time from a start timestamp.
 * Returns 0 when not active or no start time.
 */
export function useElapsedTimer(
  startTime: number | null,
  isActive: boolean
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || !isActive) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, ELAPSED_UPDATE_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [startTime, isActive]);

  return elapsed;
}

/**
 * Manage live output and timing for the currently executing task.
 * Groups related state for tracking a running task's output.
 */
export function useLiveTaskOutput() {
  const [output, setOutput] = useState<TaskOutput>({
    stdout: '',
    stderr: '',
    error: '',
  });
  const [startTime, setStartTime] = useState<number | null>(null);

  const start = useCallback(() => {
    setOutput({ stdout: '', stderr: '', error: '' });
    setStartTime(Date.now());
  }, []);

  const stop = useCallback(() => {
    setStartTime(null);
  }, []);

  return {
    output,
    startTime,
    setOutput,
    start,
    stop,
  };
}

/**
 * Handle execution cancellation with a ref-based flag.
 * The ref is needed because callbacks check the current cancellation state.
 */
export function useCancellation() {
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
  }, []);

  return {
    cancelledRef,
    cancel,
    reset,
  };
}

const MINIMUM_PROCESSING_TIME = 400;

interface ProcessorConfig {
  inputTasks: Task[];
  service: LLMService;
  isActive: boolean;
  hasProcessed: boolean;
  tasksCount: number;
  dispatch: Dispatch<ExecuteAction>;
  requestHandlers: RequestHandlers<ExecuteState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
}

/**
 * Helper to create ExecuteState with defaults
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
 * Process input tasks through AI to generate executable commands.
 * Handles the initial phase of task execution.
 */
export function useTaskProcessor(config: ProcessorConfig): void {
  const {
    inputTasks,
    service,
    isActive,
    hasProcessed,
    tasksCount,
    dispatch,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  } = config;

  useEffect(() => {
    if (!isActive || tasksCount > 0 || hasProcessed) {
      return;
    }

    let mounted = true;

    async function process(svc: LLMService) {
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

        // Create task infos from commands
        const taskInfos = result.commands.map(
          (cmd, index) =>
            ({
              label: inputTasks[index]?.action ?? cmd.description,
              command: cmd,
              status: ExecutionStatus.Pending,
              elapsed: 0,
            }) as TaskInfo
        );

        dispatch({
          type: ExecuteActionType.CommandsReady,
          payload: {
            message: result.message,
            summary: result.summary,
            tasks: taskInfos,
          },
        });

        requestHandlers.onCompleted(
          createExecuteState({
            message: result.message,
            summary: result.summary,
            tasks: taskInfos,
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
    tasksCount,
    hasProcessed,
    dispatch,
  ]);
}

interface ExecutorConfig {
  isActive: boolean;
  tasks: TaskInfo[];
  message: string;
  summary: string;
  error: string | null;
  workdir: string | undefined;
  setWorkdir: (dir: string | undefined) => void;
  cancelledRef: RefObject<boolean>;
  liveOutput: {
    setOutput: (output: TaskOutput) => void;
    start: () => void;
    stop: () => void;
  };
  dispatch: Dispatch<ExecuteAction>;
  requestHandlers: RequestHandlers<ExecuteState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
}

/**
 * Execute tasks sequentially, managing state and handling completion/errors.
 */
export function useTaskExecutor(config: ExecutorConfig): void {
  const {
    isActive,
    tasks,
    message,
    summary,
    error,
    workdir,
    setWorkdir,
    cancelledRef,
    liveOutput,
    dispatch,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  } = config;

  const currentTaskIndex = getCurrentTaskIndex(tasks);

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
      payload: { index: currentTaskIndex },
    });

    // Reset live state for new task
    liveOutput.start();

    // Merge workdir into command
    const command = workdir
      ? { ...currentTask.command, workdir }
      : currentTask.command;

    void executeTask(command, currentTaskIndex, {
      onOutputChange: (output) => {
        if (!cancelledRef.current) {
          liveOutput.setOutput(output);
        }
      },
      onComplete: (elapsed, output) => {
        if (cancelledRef.current) return;

        liveOutput.stop();

        // Track working directory
        if (output.workdir) {
          setWorkdir(output.workdir);
        }

        const tasksWithOutput = tasks.map((task, i) =>
          i === currentTaskIndex
            ? {
                ...task,
                stdout: output.stdout,
                stderr: output.stderr,
                error: output.error,
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
      onError: (errorMsg, elapsed, output) => {
        if (cancelledRef.current) return;

        liveOutput.stop();

        // Track working directory
        if (output.workdir) {
          setWorkdir(output.workdir);
        }

        const tasksWithOutput = tasks.map((task, i) =>
          i === currentTaskIndex
            ? {
                ...task,
                stdout: output.stdout,
                stderr: output.stderr,
                error: output.error,
              }
            : task
        );

        const result = handleTaskFailure(currentTaskIndex, errorMsg, elapsed, {
          tasks: tasksWithOutput,
          message,
          summary,
        });

        dispatch(result.action);
        requestHandlers.onCompleted(result.finalState);

        if (result.action.type === ExecuteActionType.TaskErrorCritical) {
          const criticalErrorMessage = getExecutionErrorMessage(errorMsg);
          workflowHandlers.addToQueue(
            createFeedback({
              type: FeedbackType.Failed,
              message: criticalErrorMessage,
            })
          );
        }

        if (result.shouldComplete) {
          lifecycleHandlers.completeActive();
        }
      },
    });
  }, [
    isActive,
    tasks,
    currentTaskIndex,
    message,
    summary,
    error,
    workdir,
    setWorkdir,
    cancelledRef,
    liveOutput,
    dispatch,
    requestHandlers,
    lifecycleHandlers,
    workflowHandlers,
  ]);
}
