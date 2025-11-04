import React from 'react';
import { Box } from 'ink';

import { createAnthropicService } from '../services/anthropic.js';

import { ConfigSetup } from './ConfigSetup.js';
import { Command } from './Command.js';

interface ConfigThenCommandProps {
  command: string;
  onConfigSave: (apiKey: string, model: string) => void;
}

export function ConfigThenCommand({
  command,
  onConfigSave,
}: ConfigThenCommandProps) {
  const [configComplete, setConfigComplete] = React.useState(false);
  const [savedConfig, setSavedConfig] = React.useState<{
    apiKey: string;
    model: string;
  } | null>(null);

  const handleConfigComplete = (config: { apiKey: string; model: string }) => {
    onConfigSave(config.apiKey, config.model);
    setSavedConfig(config);
    setConfigComplete(true);
  };

  return (
    <Box marginTop={1} flexDirection="column" gap={1}>
      <ConfigSetup onComplete={handleConfigComplete} />
      {configComplete && savedConfig && (
        <Command
          rawCommand={command}
          claudeService={createAnthropicService(
            savedConfig.apiKey,
            savedConfig.model
          )}
        />
      )}
    </Box>
  );
}
