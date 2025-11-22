import React from 'react';

import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import {
  CommandHandlers,
  ConfigHandlers,
  HandlerOperations,
} from '../types/handlers.js';
import { ComponentName, FeedbackType } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  createCommandDefinition,
  createFeedback,
  markAsDone,
} from '../services/components.js';
import { saveAnthropicConfig, saveConfig } from '../services/configuration.js';
import { FeedbackMessages } from '../services/messages.js';
import { exitApp } from '../services/process.js';
import { withQueueHandler } from '../services/queue.js';

interface AnthropicConfig extends Record<string, string> {
  key: string;
  model: string;
}

/**
 * Creates all config handlers
 */
export function createConfigHandlers(
  ops: HandlerOperations,
  handleAborted: (operationName: string) => void,
  command: string | null,
  commandHandlers: CommandHandlers,
  setService: React.Dispatch<React.SetStateAction<AnthropicService | null>>
): ConfigHandlers {
  const onFinished = (config: Record<string, string>) => {
    const anthropicConfig = config as AnthropicConfig;
    saveAnthropicConfig(anthropicConfig);
    const newService = createAnthropicService(anthropicConfig);
    setService(newService);

    ops.setQueue(
      withQueueHandler(
        ComponentName.Config,
        (first, rest): ComponentDefinition[] => {
          ops.addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(
              FeedbackType.Succeeded,
              FeedbackMessages.ConfigurationComplete
            )
          );

          if (command) {
            return [
              ...rest,
              createCommandDefinition(
                command,
                newService,
                commandHandlers.onError,
                commandHandlers.onComplete,
                commandHandlers.onAborted
              ),
            ];
          }

          exitApp(0);
          return rest;
        },
        false,
        0
      )
    );
  };

  const onAborted = () => {
    handleAborted('Configuration');
  };

  return { onFinished, onAborted };
}

/**
 * Creates config execution finished handler for CONFIG skill
 * Saves arbitrary config keys and exits
 */
export function createConfigExecutionFinishedHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void,
  keys: string[]
) {
  return (config: Record<string, string>) => {
    // Group by top-level section
    const sections: Record<string, Record<string, unknown>> = {};

    for (const fullKey of keys) {
      const parts = fullKey.split('.');
      const shortKey = parts[parts.length - 1];
      const topSection = parts[0];

      // Initialize section if needed
      sections[topSection] = sections[topSection] ?? {};

      if (shortKey in config) {
        const value = config[shortKey];

        // Build nested structure recursively
        let current: Record<string, unknown> = sections[topSection];
        for (let i = 1; i < parts.length - 1; i++) {
          current[parts[i]] = current[parts[i]] ?? {};
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;
      }
    }

    for (const [section, sectionConfig] of Object.entries(sections)) {
      saveConfig(section, sectionConfig);
    }

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

        exitApp(0);
        return rest;
      },
      false,
      0
    );
  };
}

/**
 * Creates config execution aborted handler for CONFIG skill
 */
export function createConfigExecutionAbortedHandler(
  addToTimeline: (...items: ComponentDefinition[]) => void
) {
  return () => {
    return withQueueHandler(
      ComponentName.Config,
      (first, rest): ComponentDefinition[] => {
        addToTimeline(
          markAsDone(first as StatefulComponentDefinition),
          createFeedback(FeedbackType.Aborted, 'Configuration cancelled.')
        );

        exitApp(0);
        return rest;
      },
      false,
      0
    );
  };
}
