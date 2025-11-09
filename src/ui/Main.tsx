import React from 'react';

import { AppInfo, ComponentDefinition } from '../types/components.js';

import { AnthropicService } from '../services/anthropic.js';

import { Column } from './Column.js';
import { ConfigStep } from './Config.js';

interface AnthropicConfig extends Record<string, string> {
  key: string;
  model: string;
}

interface MainProps {
  app: AppInfo;
  command: string | null;
  service?: AnthropicService;
  isReady: boolean;
  onConfigured?: (config: AnthropicConfig) => AnthropicService | void;
}

function createWelcomeDefinition(app: AppInfo): ComponentDefinition {
  return {
    name: 'welcome',
    props: { app },
  };
}

function createConfigSteps(): ConfigStep[] {
  return [
    { description: 'Anthropic API key', key: 'key', value: null },
    {
      description: 'Model',
      key: 'model',
      value: 'claude-haiku-4-5-20251001',
    },
  ];
}

function createConfigDefinition(
  onFinished: (config: Record<string, string>) => void
): ComponentDefinition {
  return {
    name: 'config',
    state: { done: false },
    props: {
      steps: createConfigSteps(),
      onFinished,
    },
  };
}

function createCommandDefinition(
  command: string,
  service: AnthropicService
): ComponentDefinition {
  return {
    name: 'command',
    state: {
      done: false,
      isLoading: true,
    },
    props: {
      command,
      service,
    },
  };
}

export const Main = ({
  app,
  command,
  service,
  isReady,
  onConfigured,
}: MainProps) => {
  const [history, setHistory] = React.useState<ComponentDefinition[]>([]);
  const [current, setCurrent] = React.useState<ComponentDefinition | null>(
    null
  );

  const handleConfigFinished = React.useCallback(
    (config: Record<string, string>) =>
      onConfigured?.(config as AnthropicConfig),
    [onConfigured]
  );

  // Initialize configuration flow when not ready
  React.useEffect(() => {
    if (!isReady) {
      setHistory([createWelcomeDefinition(app)]);
      setCurrent(createConfigDefinition(handleConfigFinished));
    }
  }, [isReady, app, handleConfigFinished]);

  // Initialize command execution when ready with a command
  React.useEffect(() => {
    if (isReady && command && service) {
      setCurrent(createCommandDefinition(command, service));
    }
  }, [isReady, command, service]);

  // Show welcome screen when ready but no command
  React.useEffect(() => {
    if (isReady && !command) {
      setCurrent(createWelcomeDefinition(app));
    }
  }, [isReady, command, app]);

  const items = [...history, ...(current ? [current] : [])];

  return <Column items={items} />;
};
