import { memo, ReactElement } from 'react';

import {
  ComponentDefinition,
  ComponentStatus,
  ManagedComponentDefinition,
} from '../types/components.js';
import { ComponentName } from '../types/types.js';
import {
  BaseState,
  LifecycleHandlers,
  RequestHandlers,
  WorkflowHandlers,
} from '../types/handlers.js';

import { DebugLevel } from '../configuration/types.js';

import { Answer, AnswerView } from './controllers/Answer.js';
import { Command, CommandView } from './controllers/Command.js';
import { Config, ConfigView } from './controllers/Config.js';
import { Confirm, ConfirmView } from './controllers/Confirm.js';
import { Debug } from './views/Debug.js';
import {
  Execute,
  ExecuteView,
  mapStateToViewProps,
} from './controllers/Execute.js';
import { Feedback } from './views/Feedback.js';
import { Introspect, IntrospectView } from './controllers/Introspect.js';
import { Message } from './views/Message.js';
import { Refinement, RefinementView } from './controllers/Refinement.js';
import { Report } from './views/Report.js';
import { Schedule, ScheduleView } from './controllers/Schedule.js';
import { Validate, ValidateView } from './controllers/Validate.js';
import { Welcome } from './views/Welcome.js';

interface SimpleComponentProps {
  def: ComponentDefinition;
}

/**
 * Render a simple component (no lifecycle management)
 */
export const SimpleComponent = memo(function SimpleComponent({
  def,
}: SimpleComponentProps): ReactElement {
  switch (def.name) {
    case ComponentName.Welcome: {
      const { props, status } = def;
      return <Welcome {...props} status={status} />;
    }

    case ComponentName.Feedback: {
      const { props, status } = def;
      return <Feedback {...props} status={status} />;
    }

    case ComponentName.Message: {
      const { props, status } = def;
      return <Message {...props} status={status} />;
    }

    case ComponentName.Debug: {
      const { props, status } = def;
      return <Debug {...props} status={status} />;
    }

    case ComponentName.Report: {
      const { props, status } = def;
      return <Report {...props} status={status} />;
    }

    default:
      throw new Error(`Unknown simple component: ${def.name}`);
  }
});

interface ControllerComponentProps {
  def: ManagedComponentDefinition;
  debug: DebugLevel;
  requestHandlers: RequestHandlers<BaseState>;
  lifecycleHandlers: LifecycleHandlers<ComponentDefinition>;
  workflowHandlers: WorkflowHandlers<ComponentDefinition>;
}

/**
 * Render a managed component (controller with lifecycle management)
 */
export const ControllerComponent = memo(function ControllerComponent({
  def,
  debug,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: ControllerComponentProps): ReactElement {
  switch (def.name) {
    case ComponentName.Config: {
      const {
        props: { steps, onFinished, onAborted },
        status,
      } = def;
      return (
        <Config
          steps={steps}
          onFinished={onFinished}
          onAborted={onAborted}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          status={status}
          debug={debug}
        />
      );
    }

    case ComponentName.Command: {
      const {
        props: { command, service, onAborted },
        status,
      } = def;
      return (
        <Command
          command={command}
          service={service}
          onAborted={onAborted}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={workflowHandlers}
          status={status}
        />
      );
    }

    case ComponentName.Schedule: {
      const {
        props: { message, tasks, onSelectionConfirmed },
        status,
      } = def;
      return (
        <Schedule
          message={message}
          tasks={tasks}
          onSelectionConfirmed={onSelectionConfirmed}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          status={status}
          debug={debug}
        />
      );
    }

    case ComponentName.Refinement: {
      const {
        props: { text, onAborted },
        status,
      } = def;
      return (
        <Refinement
          text={text}
          onAborted={onAborted}
          requestHandlers={requestHandlers}
          status={status}
        />
      );
    }

    case ComponentName.Confirm: {
      const {
        props: { message, onConfirmed, onCancelled },
        status,
      } = def;
      return (
        <Confirm
          message={message}
          onConfirmed={onConfirmed}
          onCancelled={onCancelled}
          requestHandlers={requestHandlers}
          status={status}
        />
      );
    }

    case ComponentName.Introspect: {
      const {
        props: { tasks, service, children },
        status,
      } = def;
      return (
        <Introspect
          tasks={tasks}
          service={service}
          children={children}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={workflowHandlers}
          status={status}
          debug={debug}
        />
      );
    }

    case ComponentName.Answer: {
      const {
        props: { question, service, upcoming },
        status,
      } = def;
      return (
        <Answer
          question={question}
          service={service}
          upcoming={upcoming}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={workflowHandlers}
          status={status}
        />
      );
    }

    case ComponentName.Validate: {
      const {
        props: {
          missingConfig,
          userRequest,
          service,
          onError,
          onValidationComplete,
          onAborted,
        },
        status,
      } = def;
      return (
        <Validate
          missingConfig={missingConfig}
          userRequest={userRequest}
          service={service}
          onError={onError}
          onValidationComplete={onValidationComplete}
          onAborted={onAborted}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={workflowHandlers}
          status={status}
        />
      );
    }

    case ComponentName.Execute: {
      const {
        props: { tasks, service, upcoming },
        status,
      } = def;
      return (
        <Execute
          tasks={tasks}
          service={service}
          upcoming={upcoming}
          requestHandlers={requestHandlers}
          lifecycleHandlers={lifecycleHandlers}
          workflowHandlers={workflowHandlers}
          status={status}
        />
      );
    }

    default:
      throw new Error(
        `Unknown managed component: ${(def as ManagedComponentDefinition).name}`
      );
  }
});

interface ViewComponentProps {
  def: ManagedComponentDefinition;
}

/**
 * Render a managed component as View only (no Controller logic)
 */
export const ViewComponent = memo(function ViewComponent({
  def,
}: ViewComponentProps): ReactElement | null {
  switch (def.name) {
    case ComponentName.Confirm: {
      const {
        props: { message },
        state,
        status,
      } = def;
      return (
        <ConfirmView
          status={status}
          message={message}
          selectedIndex={state.selectedIndex}
        />
      );
    }

    case ComponentName.Config: {
      const {
        props: { steps },
        state,
        status,
      } = def;
      return <ConfigView steps={steps} state={state} status={status} />;
    }

    case ComponentName.Schedule: {
      const {
        props: { message, tasks },
        state,
        status,
      } = def;
      return (
        <ScheduleView
          status={status}
          message={message}
          tasks={tasks}
          highlightedIndex={state.highlightedIndex}
          currentDefineGroupIndex={state.currentDefineGroupIndex}
          completedSelections={state.completedSelections}
        />
      );
    }

    case ComponentName.Execute: {
      const {
        props: { upcoming },
        state,
        status,
      } = def;
      const isActive = status === ComponentStatus.Active;
      const viewProps = mapStateToViewProps(state, isActive, upcoming);
      return <ExecuteView {...viewProps} />;
    }

    case ComponentName.Answer: {
      const {
        props: { question, upcoming },
        state,
        status,
      } = def;
      const lines = state.answer ? state.answer.split('\n') : null;
      return (
        <AnswerView
          status={status}
          question={question}
          lines={lines}
          error={state.error}
          upcoming={upcoming}
          cancelled={state.cancelled}
        />
      );
    }

    case ComponentName.Command: {
      const {
        props: { command },
        state,
        status,
      } = def;
      return <CommandView command={command} state={state} status={status} />;
    }

    case ComponentName.Introspect: {
      const {
        props: { children },
        state,
        status,
      } = def;
      const hasCapabilities = state.capabilities.length > 0;
      return (
        <IntrospectView
          status={status}
          hasCapabilities={hasCapabilities}
          error={state.error}
          children={children}
        />
      );
    }

    case ComponentName.Validate: {
      const { state, status } = def;
      return (
        <ValidateView
          status={status}
          completionMessage={state.completionMessage}
          error={state.error}
        />
      );
    }

    case ComponentName.Refinement: {
      const {
        props: { text },
        status,
      } = def;
      return <RefinementView text={text} status={status} />;
    }
    default:
      throw new Error(
        `Unknown managed component: ${(def as ManagedComponentDefinition).name}`
      );
  }
});

interface TimelineComponentProps {
  def: ComponentDefinition;
}

/**
 * Render a component in the timeline (Views only for managed, as-is for simple)
 */
export const TimelineComponent = ({
  def,
}: TimelineComponentProps): ReactElement | null => {
  switch (def.name) {
    // Simple components render as-is
    case ComponentName.Welcome:
    case ComponentName.Feedback:
    case ComponentName.Message:
    case ComponentName.Debug:
    case ComponentName.Report:
      return <SimpleComponent def={def} />;

    // Managed components render as Views
    case ComponentName.Config:
    case ComponentName.Command:
    case ComponentName.Confirm:
    case ComponentName.Schedule:
    case ComponentName.Refinement:
    case ComponentName.Validate:
    case ComponentName.Execute:
    case ComponentName.Answer:
    case ComponentName.Introspect:
      return <ViewComponent def={def as ManagedComponentDefinition} />;

    default:
      throw new Error('Unknown component type');
  }
};
