import {
  AppInfo,
  ComponentDefinition,
  ComponentName,
  FeedbackType,
  StatefulComponentDefinition,
  Task,
} from '../types/components.js';
import { AnthropicService } from './anthropic.js';
import { ConfigStep } from '../ui/Config.js';

export function markAsDone<T extends StatefulComponentDefinition>(
  component: T
): T {
  return { ...component, state: { ...component.state, done: true } };
}

export function createWelcomeDefinition(app: AppInfo): ComponentDefinition {
  return {
    name: ComponentName.Welcome,
    props: { app },
  };
}

export function createConfigSteps(): ConfigStep[] {
  return [
    { description: 'Anthropic API key', key: 'key', value: null },
    {
      description: 'Model',
      key: 'model',
      value: 'claude-haiku-4-5-20251001',
    },
  ];
}

export function createConfigDefinition(
  onFinished: (config: Record<string, string>) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    name: ComponentName.Config,
    state: { done: false },
    props: {
      steps: createConfigSteps(),
      onFinished,
      onAborted,
    },
  };
}

export function createCommandDefinition(
  command: string,
  service: AnthropicService,
  onError: (error: string) => void,
  onComplete: (message: string, tasks: Task[]) => void
): ComponentDefinition {
  return {
    name: ComponentName.Command,
    state: {
      done: false,
      isLoading: true,
    },
    props: {
      command,
      service,
      onError,
      onComplete,
    },
  };
}

export function createPlanDefinition(
  message: string,
  tasks: Task[]
): ComponentDefinition {
  return {
    name: ComponentName.Plan,
    props: {
      message,
      tasks,
    },
  };
}

export function createFeedback(
  type: FeedbackType,
  ...messages: string[]
): ComponentDefinition {
  return {
    name: ComponentName.Feedback,
    props: {
      type,
      message: messages.join('\n\n'),
    },
  };
}

export function createMessage(text: string): ComponentDefinition {
  return {
    name: ComponentName.Message,
    props: {
      text,
    },
  };
}

export function isStateless(component: ComponentDefinition): boolean {
  return !('state' in component);
}
