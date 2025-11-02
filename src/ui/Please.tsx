import React from 'react';

import { Welcome } from './Welcome.js';

interface AppInfo {
  name: string;
  version: string;
  description: string;
  isDev: boolean;
}

interface PleaseProps {
  app: AppInfo;
}

export const Please = ({ app: info }: PleaseProps) => {
  return <Welcome info={info} />;
};
