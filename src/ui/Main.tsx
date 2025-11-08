import React from 'react';

import { AppInfo, ComponentDefinition } from '../types/components.js';

import { AnthropicService } from '../services/anthropic.js';

import { Column } from './Column.js';

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

  React.useEffect(() => {
    // Initialize history and current component based on props
    if (!isReady) {
      // Not configured - show welcome in history, config as current
      setHistory([
        {
          name: 'welcome',
          props: {
            app,
          },
        },
      ]);

      const configSteps: Array<{
        description: string;
        key: string;
        value: string | null;
      }> = [
        { description: 'Anthropic API key', key: 'key', value: null },
        {
          description: 'Model',
          key: 'model',
          value: 'claude-haiku-4-5-20251001',
        },
      ];

      setCurrent({
        name: 'config',
        state: {
          done: false,
        },
        props: {
          steps: configSteps,
          onFinished: (config) => {
            if (onConfigured) {
              onConfigured(config as AnthropicConfig);
            }
          },
        },
      });
    } else if (command && service) {
      setCurrent({
        name: 'command',
        state: {
          done: false,
          isLoading: true,
        },
        props: {
          command,
          service,
        },
      });
    } else {
      setCurrent({
        name: 'welcome',
        props: {
          app,
        },
      });
    }
  }, [isReady, command, service, app, onConfigured]);

  const items = [...history, ...(current ? [current] : [])];

  return <Column items={items} />;
};
