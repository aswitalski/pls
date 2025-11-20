import React from 'react';

import {
  Capability,
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { App, FeedbackType, Task } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import { CommandOutput } from '../services/shell.js';
import {
  getConfigurationRequiredMessage,
  hasValidAnthropicKey,
  loadConfig,
  loadDebugSetting,
  saveDebugSetting,
} from '../services/configuration.js';
import { registerGlobalShortcut } from '../services/keyboard.js';
import { getCancellationMessage } from '../services/messages.js';
import {
  createCommandDefinition,
  createConfigDefinition,
  createFeedback,
  createMessage,
  createWelcomeDefinition,
  isStateless,
  markAsDone,
} from '../services/components.js';
import { exitApp } from '../services/process.js';

import {
  createAnswerAbortedHandler,
  createAnswerCompleteHandler,
  createAnswerErrorHandler,
} from '../handlers/answer.js';
import {
  createExecuteAbortedHandler,
  createExecuteCompleteHandler,
  createExecuteErrorHandler,
} from '../handlers/execute.js';
import {
  createCommandAbortedHandler,
  createCommandCompleteHandler,
  createCommandErrorHandler,
} from '../handlers/command.js';
import {
  createConfigAbortedHandler,
  createConfigFinishedHandler,
} from '../handlers/config.js';
import {
  createExecutionCancelledHandler,
  createExecutionConfirmedHandler,
} from '../handlers/execution.js';
import {
  createIntrospectAbortedHandler,
  createIntrospectCompleteHandler,
  createIntrospectErrorHandler,
} from '../handlers/introspect.js';
import {
  createPlanAbortedHandler,
  createPlanAbortHandlerFactory,
  createPlanSelectionConfirmedHandler,
} from '../handlers/plan.js';

import { Column } from './Column.js';

interface MainProps {
  app: App;
  command: string | null;
}

export const Main = ({ app, command }: MainProps) => {
  // Initialize service from existing config if available
  const [service, setService] = React.useState<AnthropicService | null>(() => {
    if (hasValidAnthropicKey()) {
      const config = loadConfig();
      return createAnthropicService(config.anthropic);
    }
    return null;
  });

  const [timeline, setTimeline] = React.useState<ComponentDefinition[]>([]);
  const [queue, setQueue] = React.useState<ComponentDefinition[]>([]);
  const [isDebug, setIsDebug] = React.useState<boolean>(() =>
    loadDebugSetting()
  );

  // Use ref to track latest timeline for callbacks
  const timelineRef = React.useRef<ComponentDefinition[]>(timeline);
  React.useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  // Register global keyboard shortcuts
  React.useEffect(() => {
    // Shift+Tab: Toggle debug mode
    registerGlobalShortcut('shift+tab', () => {
      setIsDebug((prev) => {
        const newValue = !prev;
        saveDebugSetting(newValue);
        return newValue;
      });
    });
  }, []);

  const addToTimeline = React.useCallback((...items: ComponentDefinition[]) => {
    setTimeline((timeline) => [...timeline, ...items]);
  }, []);

  const processNextInQueue = React.useCallback(() => {
    setQueue((currentQueue) => {
      if (currentQueue.length === 0) return currentQueue;

      const [first, ...rest] = currentQueue;

      // Stateless components auto-complete immediately
      if (isStateless(first)) {
        addToTimeline(first);
        return rest;
      }

      return currentQueue;
    });
  }, [addToTimeline]);

  const handleCommandError = React.useCallback(
    (error: string) =>
      setQueue(createCommandErrorHandler(addToTimeline)(error)),
    [addToTimeline]
  );

  const handleAborted = React.useCallback(
    (operationName: string) => {
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;
        if (!isStateless(first)) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(
              FeedbackType.Aborted,
              getCancellationMessage(operationName)
            )
          );
        }
        exitApp(0);
        return [];
      });
    },
    [addToTimeline]
  );

  const handleConfigAborted = React.useCallback(
    createConfigAbortedHandler(handleAborted),
    [handleAborted]
  );

  const handlePlanAborted = React.useCallback(
    createPlanAbortedHandler(handleAborted),
    [handleAborted]
  );

  const createPlanAbortHandler = React.useCallback(
    createPlanAbortHandlerFactory(handleAborted, handlePlanAborted),
    [handleAborted, handlePlanAborted]
  );

  const handleCommandAborted = React.useCallback(
    createCommandAbortedHandler(handleAborted),
    [handleAborted]
  );

  const handleRefinementAborted = React.useCallback(() => {
    handleAborted('Plan refinement');
  }, [handleAborted]);

  const handleIntrospectAborted = React.useCallback(
    createIntrospectAbortedHandler(handleAborted),
    [handleAborted]
  );

  const handleIntrospectError = React.useCallback(
    (error: string) =>
      setQueue(createIntrospectErrorHandler(addToTimeline)(error)),
    [addToTimeline]
  );

  const handleIntrospectComplete = React.useCallback(
    (message: string, capabilities: Capability[]) =>
      setQueue(
        createIntrospectCompleteHandler(addToTimeline)(message, capabilities)
      ),
    [addToTimeline]
  );

  const handleAnswerAborted = React.useCallback(
    createAnswerAbortedHandler(handleAborted),
    [handleAborted]
  );

  const handleAnswerError = React.useCallback(
    (error: string) => setQueue(createAnswerErrorHandler(addToTimeline)(error)),
    [addToTimeline]
  );

  const handleAnswerComplete = React.useCallback(
    (answer: string) =>
      setQueue(createAnswerCompleteHandler(addToTimeline)(answer)),
    [addToTimeline]
  );

  const handleExecuteAborted = React.useCallback(
    createExecuteAbortedHandler(handleAborted),
    [handleAborted]
  );

  const handleExecuteError = React.useCallback(
    (error: string) =>
      setQueue(createExecuteErrorHandler(addToTimeline)(error)),
    [addToTimeline]
  );

  const handleExecuteComplete = React.useCallback(
    (outputs: CommandOutput[], totalElapsed: number) =>
      setQueue(
        createExecuteCompleteHandler(addToTimeline)(outputs, totalElapsed)
      ),
    [addToTimeline]
  );

  const handleExecutionConfirmed = React.useCallback(
    () =>
      setQueue(
        createExecutionConfirmedHandler(
          timelineRef,
          addToTimeline,
          service!,
          handleIntrospectError,
          handleIntrospectComplete,
          handleIntrospectAborted,
          handleAnswerError,
          handleAnswerComplete,
          handleAnswerAborted,
          handleExecuteError,
          handleExecuteComplete,
          handleExecuteAborted,
          setQueue
        )()
      ),
    [
      addToTimeline,
      service,
      handleIntrospectError,
      handleIntrospectComplete,
      handleIntrospectAborted,
      handleAnswerError,
      handleAnswerComplete,
      handleAnswerAborted,
      handleExecuteError,
      handleExecuteComplete,
      handleExecuteAborted,
    ]
  );

  const handleExecutionCancelled = React.useCallback(
    () =>
      setQueue(createExecutionCancelledHandler(timelineRef, addToTimeline)()),
    [addToTimeline]
  );

  const handlePlanSelectionConfirmed = React.useCallback(
    createPlanSelectionConfirmedHandler(
      addToTimeline,
      service!,
      handleRefinementAborted,
      createPlanAbortHandler,
      handleExecutionConfirmed,
      handleExecutionCancelled,
      setQueue
    ),
    [
      addToTimeline,
      service,
      handleRefinementAborted,
      createPlanAbortHandler,
      handleExecutionConfirmed,
      handleExecutionCancelled,
    ]
  );

  const handleCommandComplete = React.useCallback(
    (message: string, tasks: Task[]) =>
      setQueue(
        createCommandCompleteHandler(
          addToTimeline,
          createPlanAbortHandler,
          handlePlanSelectionConfirmed,
          handleExecutionConfirmed,
          handleExecutionCancelled
        )(message, tasks)
      ),
    [
      addToTimeline,
      createPlanAbortHandler,
      handlePlanSelectionConfirmed,
      handleExecutionConfirmed,
      handleExecutionCancelled,
    ]
  );

  const handleConfigFinished = React.useCallback(
    (config: Record<string, string>) =>
      setQueue(
        createConfigFinishedHandler(
          addToTimeline,
          command,
          handleCommandError,
          handleCommandComplete,
          handleCommandAborted,
          setService
        )(config)
      ),
    [
      addToTimeline,
      command,
      handleCommandError,
      handleCommandComplete,
      handleCommandAborted,
    ]
  );

  // Initialize queue on mount
  React.useEffect(() => {
    const hasConfig = !!service;

    if (command && hasConfig) {
      // With command + valid config: [Command]
      setQueue([
        createCommandDefinition(
          command,
          service,
          handleCommandError,
          handleCommandComplete,
          handleCommandAborted
        ),
      ]);
    } else if (command && !hasConfig) {
      // With command + no config: [Message, Config] (Command added after config)
      setQueue([
        createMessage(getConfigurationRequiredMessage()),
        createConfigDefinition(handleConfigFinished, handleConfigAborted),
      ]);
    } else if (!command && hasConfig) {
      // No command + valid config: [Welcome]
      setQueue([createWelcomeDefinition(app)]);
    } else {
      // No command + no config: [Welcome, Message, Config]
      setQueue([
        createWelcomeDefinition(app),
        createMessage(getConfigurationRequiredMessage(true)),
        createConfigDefinition(handleConfigFinished, handleConfigAborted),
      ]);
    }
  }, []); // Only run on mount

  // Process queue whenever it changes
  React.useEffect(() => {
    processNextInQueue();
  }, [queue, processNextInQueue]);

  // Exit when queue is empty and timeline has content (all stateless components done)
  React.useEffect(() => {
    if (queue.length === 0 && timeline.length > 0) {
      exitApp(0);
    }
  }, [queue, timeline]);

  const current = queue.length > 0 ? queue[0] : null;
  const items = React.useMemo(
    () => [...timeline, ...(current ? [current] : [])],
    [timeline, current]
  );

  return <Column items={items} debug={isDebug} />;
};
