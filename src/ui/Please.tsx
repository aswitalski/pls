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
  command?: string;
  claudeService?: AnthropicService;
  showConfigSetup?: boolean;
  onConfigComplete?: (config: { apiKey: string; model: string }) => void;
}

export const Please = ({
  app: info,
  command,
  claudeService,
  showConfigSetup,
  onConfigComplete,
}: PleaseProps) => {
  const [history, setHistory] = React.useState<React.ReactNode[]>([]);

  // Simple command execution
  if (command && claudeService) {
    return (
      <Box marginTop={1} flexDirection="column" gap={1}>
        <History items={history} />
        <Command rawCommand={command} claudeService={claudeService} />
      </Box>
    );
  }

  // Welcome screen with optional config setup
  return (
    <Box flexDirection="column" marginY={1} gap={1}>
      <History items={history} />
      <Welcome info={info} />
      {showConfigSetup && onConfigComplete && (
        <ConfigSetup onComplete={onConfigComplete} />
      )}
    </Box>
  );
};
