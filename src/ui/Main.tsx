import React from 'react';

import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { HandlerOperations } from '../types/handlers.js';
import { App, FeedbackType } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  createCommandDefinition,
  createConfigDefinition,
  createFeedback,
  createMessage,
  createWelcomeDefinition,
  isStateless,
  markAsDone,
} from '../services/components.js';
import {
  getConfigurationRequiredMessage,
  hasValidAnthropicKey,
  loadConfig,
  loadDebugSetting,
  saveDebugSetting,
} from '../services/configuration.js';
import { registerGlobalShortcut } from '../services/keyboard.js';
import { getCancellationMessage } from '../services/messages.js';
import { exitApp } from '../services/process.js';

import { createAnswerHandlers } from '../handlers/answer.js';
import { createCommandHandlers } from '../handlers/command.js';
import { createConfigHandlers } from '../handlers/config.js';
import { createExecuteHandlers } from '../handlers/execute.js';
import { createExecutionHandlers } from '../handlers/execution.js';
import { createIntrospectHandlers } from '../handlers/introspect.js';
import { createPlanHandlers } from '../handlers/plan.js';

import { Column } from './Column.js';

interface MainProps {
  app: App;
  command: string | null;
}

export const Main = ({ app, command }: MainProps) => {
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

  // Register global keyboard shortcuts
  React.useEffect(() => {
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

      if (isStateless(first)) {
        addToTimeline(first);
        return rest;
      }

      return currentQueue;
    });
  }, [addToTimeline]);

  // Core abort handler
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

  // Create operations object
  const ops: HandlerOperations = React.useMemo(
    () => ({
      addToTimeline,
      setQueue,
      service,
    }),
    [addToTimeline, service]
  );

  // Create handlers in dependency order
  const introspectHandlers = React.useMemo(
    () => createIntrospectHandlers(ops, handleAborted),
    [ops, handleAborted]
  );

  const answerHandlers = React.useMemo(
    () => createAnswerHandlers(ops, handleAborted),
    [ops, handleAborted]
  );

  const executeHandlers = React.useMemo(
    () => createExecuteHandlers(ops, handleAborted),
    [ops, handleAborted]
  );

  const executionHandlers = React.useMemo(
    () =>
      createExecutionHandlers(ops, {
        introspect: introspectHandlers,
        answer: answerHandlers,
        execute: executeHandlers,
      }),
    [ops, introspectHandlers, answerHandlers, executeHandlers]
  );

  const planHandlers = React.useMemo(
    () => createPlanHandlers(ops, handleAborted, executionHandlers),
    [ops, handleAborted, executionHandlers]
  );

  const commandHandlers = React.useMemo(
    () =>
      createCommandHandlers(
        ops,
        handleAborted,
        planHandlers,
        executionHandlers
      ),
    [ops, handleAborted, planHandlers, executionHandlers]
  );

  const configHandlers = React.useMemo(
    () =>
      createConfigHandlers(
        ops,
        handleAborted,
        command,
        commandHandlers,
        setService
      ),
    [ops, handleAborted, command, commandHandlers]
  );

  // Initialize queue on mount
  React.useEffect(() => {
    const hasConfig = !!service;

    if (command && hasConfig) {
      setQueue([
        createCommandDefinition(
          command,
          service,
          commandHandlers.onError,
          commandHandlers.onComplete,
          commandHandlers.onAborted
        ),
      ]);
    } else if (command && !hasConfig) {
      setQueue([
        createMessage(getConfigurationRequiredMessage()),
        createConfigDefinition(
          configHandlers.onFinished,
          configHandlers.onAborted
        ),
      ]);
    } else if (!command && hasConfig) {
      setQueue([createWelcomeDefinition(app)]);
    } else {
      setQueue([
        createWelcomeDefinition(app),
        createMessage(getConfigurationRequiredMessage(true)),
        createConfigDefinition(
          configHandlers.onFinished,
          configHandlers.onAborted
        ),
      ]);
    }
  }, []);

  // Process queue whenever it changes
  React.useEffect(() => {
    processNextInQueue();
  }, [queue, processNextInQueue]);

  // Exit when queue is empty and timeline has content
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
