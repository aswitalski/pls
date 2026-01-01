import { useEffect, useState } from 'react';

import { AnthropicConfig, DebugLevel } from '../configuration/types.js';
import { ComponentDefinition } from '../types/components.js';
import { App, FeedbackType } from '../types/types.js';

import {
  loadConfig,
  loadDebugSetting,
  saveConfig,
  saveDebugSetting,
} from '../configuration/io.js';
import { getConfigurationRequiredMessage } from '../configuration/messages.js';
import { getMissingConfigKeys } from '../configuration/schema.js';
import { createConfigStepsFromSchema } from '../configuration/steps.js';
import { unflattenConfig } from '../configuration/transformation.js';
import { LLMService, createAnthropicService } from '../services/anthropic.js';
import {
  createCommand,
  createConfig,
  createFeedback,
  createMessage,
  createWelcome,
} from '../services/components.js';
import { registerGlobalShortcut } from '../services/keyboard.js';
import { initializeLogger, setDebugLevel } from '../services/logger.js';

import { Workflow } from './Workflow.js';

interface MainProps {
  app: App;
  command: string | null;
  serviceFactory?: (config: AnthropicConfig) => LLMService;
}

export const Main = ({
  app,
  command,
  serviceFactory = createAnthropicService,
}: MainProps) => {
  const [service, setService] = useState<LLMService | null>(null);

  const [initialQueue, setInitialQueue] = useState<
    ComponentDefinition[] | null
  >(null);
  const [debug, setDebugLevelState] = useState<DebugLevel>(() =>
    loadDebugSetting()
  );

  // Initialize logger on mount
  useEffect(() => {
    initializeLogger();
  }, []);

  // Update logger when debug level changes
  useEffect(() => {
    setDebugLevel(debug);
  }, [debug]);

  // Register global keyboard shortcuts
  useEffect(() => {
    registerGlobalShortcut('shift+tab', () => {
      setDebugLevelState((prev) => {
        // Cycle through: None -> Info -> Verbose -> None
        const newValue =
          prev === DebugLevel.None
            ? DebugLevel.Info
            : prev === DebugLevel.Info
              ? DebugLevel.Verbose
              : DebugLevel.None;
        saveDebugSetting(newValue);
        return newValue;
      });
    });
  }, []);

  // Initialize service on mount
  useEffect(() => {
    if (service !== null) {
      return;
    }

    const missingKeys = getMissingConfigKeys();

    if (missingKeys.length === 0) {
      // Config exists - create service immediately
      try {
        const config = loadConfig();
        const newService = serviceFactory(config.anthropic);
        setService(newService);
      } catch (error) {
        // Service creation failed - show error and exit
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to initialize service';
        setInitialQueue([
          createFeedback({ type: FeedbackType.Failed, message: errorMessage }),
        ]);
      }
    }
    // If config is missing, service will be created after config completes
  }, [service, serviceFactory]);

  // Initialize queue after service is ready
  useEffect(() => {
    // Only set initial queue once
    if (initialQueue !== null) {
      return;
    }

    const missingKeys = getMissingConfigKeys();

    if (missingKeys.length > 0) {
      // Missing config - show initial configuration flow
      const handleConfigFinished = (config: Record<string, string>) => {
        // Save config and create service
        try {
          const configBySection = unflattenConfig(config);

          for (const [section, sectionConfig] of Object.entries(
            configBySection
          )) {
            saveConfig(section, sectionConfig);
          }

          // Load config and create service
          const newConfig = loadConfig();
          const newService = serviceFactory(newConfig.anthropic);
          setService(newService);
        } catch (error) {
          // Config save failed
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to save configuration';
          throw new Error(errorMessage);
        }
      };

      const handleConfigAborted = (_operation: string) => {
        // Config was cancelled
      };

      setInitialQueue([
        createWelcome({ app }),
        createMessage({ text: getConfigurationRequiredMessage() }),
        createConfig({
          steps: createConfigStepsFromSchema(missingKeys),
          onFinished: handleConfigFinished,
          onAborted: handleConfigAborted,
        }),
      ]);
    } else if (service && command) {
      // Valid service exists and command provided - execute command
      setInitialQueue([createCommand({ command, service })]);
    } else if (service && !command) {
      // Valid service exists, no command - show welcome
      setInitialQueue([createWelcome({ app })]);
    }
    // Wait for service to be initialized before setting queue
  }, [app, command, service, initialQueue]);

  // Don't render until initial queue is ready
  if (initialQueue === null) {
    return null;
  }

  return <Workflow initialQueue={initialQueue} debug={debug} />;
};
