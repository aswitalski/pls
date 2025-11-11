import React from 'react';

import { ComponentDefinition } from '../types/components.js';

import { Command } from './Command.js';
import { Config } from './Config.js';
import { Feedback } from './Feedback.js';
import { Message } from './Message.js';
import { Plan } from './Plan.js';
import { Welcome } from './Welcome.js';

interface ComponentProps {
  def: ComponentDefinition;
}

export function Component({ def }: ComponentProps): React.ReactElement {
  switch (def.name) {
    case 'welcome':
      return <Welcome {...def.props} />;

    case 'config': {
      const props = def.props;
      const state = def.state;
      return <Config {...props} state={state} />;
    }

    case 'command': {
      const props = def.props;
      const state = def.state;
      return <Command {...props} state={state} />;
    }

    case 'plan':
      return <Plan {...def.props} />;

    case 'feedback':
      return <Feedback {...def.props} />;

    case 'message':
      return <Message {...def.props} />;
  }
}
