import React from 'react';

import { ComponentDefinition, Handlers } from '../types/components.js';
import { App, FeedbackType } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
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
  const [service, setService] = React.useState<AnthropicService | null>(() => {
    try {
      const config = loadConfig();
      return createAnthropicService(config.anthropic);
    } catch {
      // No config file exists yet
      return null;
    }
  });

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

  // Initialize queue on mount
  React.useEffect(() => {
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
    } else if (!command) {
      // Valid config exists, no command - show welcome
      setInitialQueue([createWelcomeDefinition(app)]);
    }
    // TODO: Handle command flow
  }, [app, command, service]);

  // Don't render until initial queue is ready
  if (initialQueue === null) {
    return null;
  }

  return <Workflow initialQueue={initialQueue} debug={isDebug} />;
};
