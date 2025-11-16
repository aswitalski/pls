import React from 'react';

import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { ComponentName, FeedbackType, Task } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  createCommandDefinition,
  createFeedback,
  markAsDone,
} from '../services/components.js';
import { saveAnthropicConfig } from '../services/configuration.js';
import { FeedbackMessages } from '../services/messages.js';
import { exitApp } from '../services/process.js';
import { withQueueHandler } from '../services/queue.js';

interface AnthropicConfig extends Record<string, string> {
  key: string;
  model: string;
}

/**
 * Creates config finished handler
 */
export function createConfigFinishedHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void,
  command: string | null,
  handleCommandError: (error: string) => void,
  handleCommandComplete: (message: string, tasks: Task[]) => void,
  handleCommandAborted: () => void,
  setService: React.Dispatch<React.SetStateAction<AnthropicService | null>>
) {
  return (config: Record<string, string>) => {
    const anthropicConfig = config as AnthropicConfig;
    saveAnthropicConfig(anthropicConfig);
    const newService = createAnthropicService(anthropicConfig);
    setService(newService);

    return withQueueHandler(
      ComponentName.Config,
      (first, rest): ComponentDefinition[] => {
        addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(
            FeedbackType.Succeeded,
            FeedbackMessages.ConfigurationComplete
          )
        );

        // Add command to queue if we have one
        if (command) {
          return [
            ...rest,
            createCommandDefinition(
              command,
              newService,
              handleCommandError,
              handleCommandComplete,
              handleCommandAborted
            ),
          ];
        }

        // No command - exit after showing completion message
        exitApp(0);
        return rest;
      },
      false,
      0
    );
  };
}

/**
 * Creates config aborted handler
 */
export function createConfigAbortedHandler(
  handleAborted: (operationName: string) => void
) {
  return () => {
    handleAborted('Configuration');
  };
}
