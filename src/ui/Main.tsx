import React from 'react';
import { Box } from 'ink';

import { AnthropicService } from '../services/anthropic.js';
import { ComponentDefinition, AppInfo } from '../types/components.js';

import { History } from './History.js';
import { renderComponent } from './renderComponent.js';

interface MainProps {
  app: AppInfo;
  command: string | null;
  service?: AnthropicService;
  isReady: boolean;
  onConfigured?: (config: {
    key: string;
    model: string;
  }) => AnthropicService | void;
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
      // Not configured - show welcome in history, configure as current
      setHistory([
        {
          name: 'welcome',
          props: {
            app,
          },
        },
      ]);
      setCurrent({
        name: 'configure',
        state: {
          done: false,
          step: 'key',
        },
        props: {
          onComplete: onConfigured,
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

  return (
    <Box marginTop={1} flexDirection="column" gap={1}>
      <History items={history} />
      {current && renderComponent(current)}
    </Box>
  );
};
