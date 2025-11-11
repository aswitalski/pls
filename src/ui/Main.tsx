import React from 'react';

import {
  AppInfo,
  ComponentDefinition,
  ComponentName,
  StatefulComponentDefinition,
  Task,
} from '../types/components.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import { FeedbackType } from '../types/components.js';
import {
  getConfigurationRequiredMessage,
  hasValidAnthropicKey,
  loadConfig,
  saveAnthropicConfig,
} from '../services/config.js';
import {
  createCommandDefinition,
  createConfigDefinition,
  createFeedback,
  createMessage,
  createPlanDefinition,
  createWelcomeDefinition,
  isStateless,
  markAsDone,
} from '../services/components.js';
import { exitApp } from '../services/process.js';

import { Column } from './Column.js';

interface AnthropicConfig extends Record<string, string> {
  key: string;
  model: string;
}

interface MainProps {
  app: AppInfo;
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
    (error: string) => {
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;
        if (first.name === ComponentName.Command) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(
              FeedbackType.Failed,
              'Unexpected error occurred:',
              error
            )
          );
        }
        exitApp(1);
        return [];
      });
    },
    [addToTimeline]
  );

  const handleCommandComplete = React.useCallback(
    (message: string, tasks: Task[]) => {
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;
        if (first.name === ComponentName.Command) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createPlanDefinition(message, tasks)
          );
        }
        exitApp(0);
        return [];
      });
    },
    [addToTimeline]
  );

  const handleConfigFinished = React.useCallback(
    (config: Record<string, string>) => {
      const anthropicConfig = config as AnthropicConfig;
      saveAnthropicConfig(anthropicConfig);
      const newService = createAnthropicService(anthropicConfig);
      setService(newService);

      // Complete config component and add command if present
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first, ...rest] = currentQueue;
        if (first.name === ComponentName.Config) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(FeedbackType.Succeeded, 'Configuration complete')
          );
        }

        // Add command to queue if we have one
        if (command) {
          return [
            ...rest,
            createCommandDefinition(
              command,
              newService,
              handleCommandError,
              handleCommandComplete
            ),
          ];
        }

        // No command - exit after showing completion message
        exitApp(0);
        return rest;
      });
    },
    [addToTimeline, command, handleCommandError, handleCommandComplete]
  );

  const handleConfigAborted = React.useCallback(() => {
    setQueue((currentQueue) => {
      if (currentQueue.length === 0) return currentQueue;
      const [first] = currentQueue;
      if (first.name === ComponentName.Config) {
        addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(FeedbackType.Aborted, 'Configuration aborted by user')
        );
      }
      exitApp(0);
      return [];
    });
  }, [addToTimeline]);

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
          handleCommandComplete
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

  const current = queue.length > 0 ? queue[0] : null;
  const items = [...timeline, ...(current ? [current] : [])];

  return <Column items={items} />;
};
