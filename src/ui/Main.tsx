import { useEffect, useState } from 'react';

import { ComponentDefinition } from '../types/components.js';
import { App, FeedbackType } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  createCommandDefinition,
  createConfigDefinitionWithKeys,
  createFeedback,
  createMessage,
  createWelcomeDefinition,
} from '../services/components.js';
import {
  DebugLevel,
  getConfigurationRequiredMessage,
  getMissingConfigKeys,
  loadConfig,
  loadDebugSetting,
  saveAnthropicConfig,
  saveDebugSetting,
} from '../services/configuration.js';
import { registerGlobalShortcut } from '../services/keyboard.js';
import { initializeLogger, setDebugLevel } from '../services/logger.js';

import { Workflow } from './Workflow.js';

interface MainProps {
  app: App;
  command: string | null;
}

export const Main = ({ app, command }: MainProps) => {
  const [service, setService] = useState<AnthropicService | null>(null);

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
        const newService = createAnthropicService(config.anthropic);
        setService(newService);
      } catch (error) {
        // Service creation failed - show error and exit
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to initialize service';
        setInitialQueue([createFeedback(FeedbackType.Failed, errorMessage)]);
      }
    }
    // If config is missing, service will be created after config completes
  }, [service]);

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
          const newConfig = saveAnthropicConfig(
            config as { key: string; model: string }
          );
          const newService = createAnthropicService(newConfig.anthropic);
          setService(newService);
        } catch (error) {
          // Config creation failed - show error
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to save configuration';
          setInitialQueue([createFeedback(FeedbackType.Failed, errorMessage)]);
        }
      };

      const handleConfigAborted = (operation: string) => {
        // Config was cancelled - just exit
      };

      setInitialQueue([
        createWelcomeDefinition(app),
        createMessage(getConfigurationRequiredMessage()),
        createConfigDefinitionWithKeys(
          missingKeys,
          handleConfigFinished,
          handleConfigAborted
        ),
      ]);
    } else if (service && command) {
      // Valid service exists and command provided - execute command
      setInitialQueue([createCommandDefinition(command, service)]);
    } else if (service && !command) {
      // Valid service exists, no command - show welcome
      setInitialQueue([createWelcomeDefinition(app)]);
    }
    // Wait for service to be initialized before setting queue
  }, [app, command, service, initialQueue]);

  // Don't render until initial queue is ready
  if (initialQueue === null) {
    return null;
  }

  return <Workflow initialQueue={initialQueue} debug={debug} />;
};
