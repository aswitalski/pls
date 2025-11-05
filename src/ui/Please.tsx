import React from 'react';
import { Box } from 'ink';

import { AnthropicService } from '../services/anthropic.js';

import { Command } from './Command.js';
import { Welcome } from './Welcome.js';
import { ConfigSetup } from './ConfigSetup.js';
import { History } from './History.js';

interface AppInfo {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
}

interface PleaseProps {
  app: AppInfo;
  command: string | null;
  claudeService?: AnthropicService;
  showConfigSetup?: boolean;
  onConfigComplete?: (config: {
    apiKey: string;
    model: string;
  }) => AnthropicService | void;
}

export const PLS = ({
  app: info,
  command,
  claudeService,
  showConfigSetup,
  onConfigComplete,
}: PleaseProps) => {
  const [history, setHistory] = React.useState<React.ReactNode[]>([]);
  const [service, setService] = React.useState<AnthropicService | undefined>(
    claudeService
  );

  const handleConfigComplete = (config: { apiKey: string; model: string }) => {
    if (onConfigComplete) {
      const result = onConfigComplete(config);
      if (result) {
        setService(result);
      }
    }
  };

  // Command execution (with service from props or after config)
  if (command && service) {
    return (
      <Box marginTop={1} flexDirection="column" gap={1}>
        <History items={history} />
        <Command rawCommand={command} claudeService={service} />
      </Box>
    );
  }

  // Welcome screen with optional config setup
  return (
    <Box flexDirection="column" marginY={1} gap={1}>
      <History items={history} />
      {!showConfigSetup && <Welcome info={info} />}
      {showConfigSetup && <ConfigSetup onComplete={handleConfigComplete} />}
    </Box>
  );
};
