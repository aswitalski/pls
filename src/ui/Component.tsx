import React from 'react';

import { ComponentDefinition, ComponentName } from '../types/components.js';

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
    case ComponentName.Welcome:
      return <Welcome {...def.props} />;

    case ComponentName.Config: {
      const props = def.props;
      const state = def.state;
      return <Config {...props} state={state} />;
    }

    case ComponentName.Command: {
      const props = def.props;
      const state = def.state;
      return <Command {...props} state={state} />;
    }

    case ComponentName.Plan:
      return <Plan {...def.props} />;

    case ComponentName.Feedback:
      return <Feedback {...def.props} />;

    case ComponentName.Message:
      return <Message {...def.props} />;
  }
}
