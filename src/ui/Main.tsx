import React from 'react';

import { ComponentDefinition, Handlers } from '../types/components.js';
import { App } from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  createProgressDefinition,
  createWelcomeDefinition,
} from '../services/components.js';
import {
  hasValidAnthropicKey,
  loadConfig,
  loadDebugSetting,
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
    if (hasValidAnthropicKey()) {
      const config = loadConfig();
      return createAnthropicService(config.anthropic);
    }
    return null;
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

  // Placeholder handlers (will be replaced by Workflow's real handlers)
  const placeholderHandlers: Handlers = React.useMemo(
    () => ({
      onComplete: () => {},
      onAborted: (_operation: string) => {},
      onError: (_error: string) => {},
    }),
    []
  );

  // Initialize queue on mount
  React.useEffect(() => {
    const hasConfig = !!service;

    // Initial implementation: only handle Welcome flow
    if (!command && hasConfig) {
      setInitialQueue([createWelcomeDefinition(app)]);
    }
    // TODO: Handle other flows (config, command) in future implementation
  }, [app, command, service, placeholderHandlers]);

  // Don't render until initial queue is ready
  if (initialQueue === null) {
    return null;
  }

  return <Workflow initialQueue={initialQueue} debug={isDebug} />;
};
