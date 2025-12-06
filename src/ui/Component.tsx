import { memo, ReactElement } from 'react';

import { ComponentDefinition } from '../types/components.js';
import { ComponentName } from '../types/types.js';

import { Answer } from './Answer.js';
import { Command } from './Command.js';
import { Confirm } from './Confirm.js';
import { Config } from './Config.js';
import { Execute } from './Execute.js';
import { Feedback } from './Feedback.js';
import { Introspect } from './Introspect.js';
import { Message } from './Message.js';
import { Plan } from './Plan.js';
import { Refinement } from './Refinement.js';
import { Report } from './Report.js';
import { Validate } from './Validate.js';
import { Welcome } from './Welcome.js';

interface ComponentProps {
  def: ComponentDefinition;
  debug: boolean;
}

export const Component = memo(function Component({
  def,
  debug,
}: ComponentProps): ReactElement {
  switch (def.name) {
    case ComponentName.Welcome:
      return <Welcome {...def.props} status={def.status} />;

    case ComponentName.Config:
      return (
        <Config
          {...def.props}
          state={def.state}
          status={def.status}
          debug={debug}
        />
      );

    case ComponentName.Command:
      return <Command {...def.props} state={def.state} status={def.status} />;

    case ComponentName.Plan:
      return (
        <Plan
          {...def.props}
          state={def.state}
          status={def.status}
          debug={debug}
        />
      );

    case ComponentName.Feedback:
      return <Feedback {...def.props} status={def.status} />;

    case ComponentName.Message:
      return <Message {...def.props} status={def.status} />;

    case ComponentName.Refinement:
      return (
        <Refinement {...def.props} state={def.state} status={def.status} />
      );

    case ComponentName.Confirm:
      return <Confirm {...def.props} state={def.state} status={def.status} />;

    case ComponentName.Introspect:
      return (
        <Introspect
          {...def.props}
          state={def.state}
          status={def.status}
          debug={debug}
        />
      );

    case ComponentName.Report:
      return <Report {...def.props} status={def.status} />;

    case ComponentName.Answer:
      return <Answer {...def.props} state={def.state} status={def.status} />;

    case ComponentName.Execute:
      return <Execute {...def.props} state={def.state} status={def.status} />;

    case ComponentName.Validate:
      return (
        <Validate
          {...def.props}
          state={def.state}
          status={def.status}
          debug={debug}
        />
      );
  }
});
