import React from 'react';

import { AnthropicService } from '../services/anthropic.js';

import { Command } from './Command.js';
import { Welcome } from './Welcome.js';

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
}

export const Please = ({ app: info, command, claudeService }: PleaseProps) => {
  if (command && claudeService) {
    return <Command rawCommand={command} claudeService={claudeService} />;
  }

  return <Welcome info={info} />;
};
