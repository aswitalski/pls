import { randomUUID } from 'node:crypto';

import {
  AppInfo,
  ComponentDefinition,
  ComponentName,
  FeedbackType,
  StatefulComponentDefinition,
  Task,
} from '../types/components.js';
import { AnthropicService } from './anthropic.js';
import { ConfigStep, StepType } from '../ui/Config.js';
import {
  AnthropicModel,
  isValidAnthropicApiKey,
  isValidAnthropicModel,
} from './config.js';

export function markAsDone<T extends StatefulComponentDefinition>(
  component: T
): T {
  return { ...component, state: { ...component.state, done: true } };
}

export function createWelcomeDefinition(app: AppInfo): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Welcome,
    props: { app },
  };
}

export function createConfigSteps(): ConfigStep[] {
  return [
    {
      description: 'Anthropic API key',
      key: 'key',
      type: StepType.Text,
      value: null,
      validate: isValidAnthropicApiKey,
    },
    {
      description: 'Model',
      key: 'model',
      type: StepType.Selection,
      options: [
        { label: 'Haiku 4.5', value: AnthropicModel.Haiku },
        { label: 'Sonnet 4.5', value: AnthropicModel.Sonnet },
        { label: 'Opus 4.1', value: AnthropicModel.Opus },
      ],
      defaultIndex: 0,
      validate: isValidAnthropicModel,
    },
  ];
}

export function createConfigDefinition(
  onFinished: (config: Record<string, string>) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
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
    id: randomUUID(),
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
  tasks: Task[],
  onSelectionConfirmed?: (selectedIndex: number, tasks: Task[]) => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Plan,
    state: {
      done: false,
      highlightedIndex: null,
      currentDefineGroupIndex: 0,
      completedSelections: [],
    },
    props: {
      message,
      tasks,
      onSelectionConfirmed,
    },
  };
}

export function createFeedback(
  type: FeedbackType,
  ...messages: string[]
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Feedback,
    props: {
      type,
      message: messages.join('\n\n'),
    },
  };
}

export function createMessage(text: string): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Message,
    props: {
      text,
    },
  };
}

export function isStateless(component: ComponentDefinition): boolean {
  return !('state' in component);
}
