import React from 'react';

import { ComponentDefinition } from '../types/components.js';
import { Welcome } from './Welcome.js';
import { Configure } from './Configure.js';
import { Command } from './Command.js';

export function renderComponent(def: ComponentDefinition): React.ReactElement {
  switch (def.name) {
    case 'welcome':
      return <Welcome {...def.props} />;
    case 'configure':
      return (
        <Configure
          {...def.props}
          state={'state' in def ? def.state : undefined}
        />
      );
    case 'command':
      return (
        <Command
          {...def.props}
          state={'state' in def ? def.state : undefined}
        />
      );
  }
}
