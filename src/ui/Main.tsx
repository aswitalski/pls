import React from 'react';

import { ComponentDefinition, Handlers } from '../types/components.js';
import { App, FeedbackType, Task } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  createCommandDefinition,
  createConfigDefinitionWithKeys,
  createMessage,
  createProgressDefinition,
  createWelcomeDefinition,
} from '../services/components.js';
import {
  getConfigurationRequiredMessage,
  getMissingConfigKeys,
  hasValidAnthropicKey,
  loadConfig,
  loadDebugSetting,
  saveAnthropicConfig,
  saveDebugSetting,
} from '../services/configuration.js';
import { registerGlobalShortcut } from '../services/keyboard.js';

import { Workflow } from './Workflow.js';

interface MainProps {
  app: App;
  command: string | null;
}

export const Main = ({ app, command }: MainProps) => {
  const [service, setService] = React.useState<AnthropicService | null>(null);

  const [initialQueue, setInitialQueue] = React.useState<
    ComponentDefinition[] | null
  >(null);
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

  // Initialize service on mount
  React.useEffect(() => {
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
      } catch {
        // Service creation failed - will show error
      }
    }
    // If config is missing, service will be created after config completes
  }, [service]);

  // Initialize queue after service is ready
  React.useEffect(() => {
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
          // Config creation failed
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

  return <Workflow initialQueue={initialQueue} debug={isDebug} />;
};
