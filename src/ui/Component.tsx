import React from 'react';

import { ComponentDefinition } from '../types/components.js';
import { ComponentName } from '../types/types.js';

import { Answer } from './Answer.js';
import { AnswerDisplay } from './AnswerDisplay.js';
import { Command } from './Command.js';
import { Confirm } from './Confirm.js';
import { Config } from './Config.js';
import { Feedback } from './Feedback.js';
import { Introspect } from './Introspect.js';
import { Message } from './Message.js';
import { Plan } from './Plan.js';
import { Refinement } from './Refinement.js';
import { Report } from './Report.js';
import { Welcome } from './Welcome.js';

interface ComponentProps {
  def: ComponentDefinition;
  debug: boolean;
}

export const Component = React.memo(function Component({
  def,
  debug,
}: ComponentProps): React.ReactElement {
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
      return <Plan {...def.props} debug={debug} />;

    case ComponentName.Feedback:
      return <Feedback {...def.props} />;

    case ComponentName.Message:
      return <Message {...def.props} />;

    case ComponentName.Refinement: {
      const props = def.props;
      const state = def.state;
      return <Refinement {...props} state={state} />;
    }

    case ComponentName.Confirm: {
      const props = def.props;
      const state = def.state;
      return <Confirm {...props} state={state} />;
    }

    case ComponentName.Introspect: {
      const props = def.props;
      const state = def.state;
      return <Introspect {...props} state={state} />;
    }

    case ComponentName.Report:
      return <Report {...def.props} />;

    case ComponentName.Answer: {
      const props = def.props;
      const state = def.state;
      return <Answer {...props} state={state} />;
    }

    case ComponentName.AnswerDisplay:
      return <AnswerDisplay {...def.props} />;
  }
});
