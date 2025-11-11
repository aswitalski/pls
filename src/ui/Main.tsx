import React from 'react';

import {
  AppInfo,
  ComponentDefinition,
  StatefulComponentDefinition,
  Task,
} from '../types/components.js';

import { AnthropicService } from '../services/anthropic.js';
import { FeedbackType } from '../types/components.js';

import { Column } from './Column.js';
import { ConfigStep } from './Config.js';

interface AnthropicConfig extends Record<string, string> {
  key: string;
  model: string;
}

interface MainProps {
  app: AppInfo;
  command: string | null;
  service?: AnthropicService;
  isReady: boolean;
  onConfigured?: (config: AnthropicConfig) => AnthropicService | void;
}

function exit(code: 0 | 1) {
  setTimeout(() => globalThis.process.exit(code), 100);
}

function markAsDone<T extends StatefulComponentDefinition>(component: T): T {
  return { ...component, state: { ...component.state, done: true } };
}

function createWelcomeDefinition(app: AppInfo): ComponentDefinition {
  return {
    name: 'welcome',
    props: { app },
  };
}

function createConfigSteps(): ConfigStep[] {
  return [
    { description: 'Anthropic API key', key: 'key', value: null },
    {
      description: 'Model',
      key: 'model',
      value: 'claude-haiku-4-5-20251001',
    },
  ];
}

function createConfigDefinition(
  onFinished: (config: Record<string, string>) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    name: 'config',
    state: { done: false },
    props: {
      steps: createConfigSteps(),
      onFinished,
      onAborted,
    },
  };
}

function createCommandDefinition(
  command: string,
  service: AnthropicService,
  onError: (error: string) => void,
  onComplete: (message: string, tasks: Task[]) => void
): ComponentDefinition {
  return {
    name: 'command',
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

function createPlanDefinition(
  message: string,
  tasks: Task[]
): ComponentDefinition {
  return {
    name: 'plan',
    props: {
      message,
      tasks,
    },
  };
}

function createFeedback(
  type: FeedbackType,
  ...messages: string[]
): ComponentDefinition {
  return {
    name: 'feedback',
    props: {
      type,
      message: messages.join('\n\n'),
    },
  };
}

export const Main = ({
  app,
  command,
  service: initialService,
  isReady,
  onConfigured,
}: MainProps) => {
  const [history, setHistory] = React.useState<ComponentDefinition[]>([]);
  const [current, setCurrent] = React.useState<ComponentDefinition | null>(
    null
  );
  const [service, setService] = React.useState<AnthropicService | undefined>(
    initialService
  );

  const addToHistory = React.useCallback((...items: ComponentDefinition[]) => {
    setHistory((history) => [...history, ...items]);
  }, []);

  const handleConfigFinished = React.useCallback(
    (config: Record<string, string>) => {
      const service = onConfigured?.(config as AnthropicConfig);
      if (service) {
        setService(service);
      }
      // Move config to history with done state and add success feedback
      setCurrent((current) => {
        if (!current) return null;
        addToHistory(
          markAsDone(current as StatefulComponentDefinition),
          createFeedback(FeedbackType.Succeeded, 'Configuration complete')
        );
        return null;
      });
    },
    [onConfigured, addToHistory]
  );

  const handleConfigAborted = React.useCallback(() => {
    // Move config to history with done state and add aborted feedback
    setCurrent((current) => {
      addToHistory(
        markAsDone(current as StatefulComponentDefinition),
        createFeedback(FeedbackType.Aborted, 'Configuration aborted by user')
      );
      // Exit after showing abort message
      exit(0);
      return null;
    });
  }, [addToHistory]);

  const handleCommandError = React.useCallback(
    (error: string) => {
      // Move command to history with done state and add error feedback
      setCurrent((current) => {
        addToHistory(
          markAsDone(current as StatefulComponentDefinition),
          createFeedback(
            FeedbackType.Failed,
            'Unexpected error occurred:',
            error
          )
        );
        // Exit after showing error
        exit(1);
        return null;
      });
    },
    [addToHistory]
  );

  const handleCommandComplete = React.useCallback(
    (message: string, tasks: Task[]) => {
      // Move command to history with done state and add plan
      setCurrent((current) => {
        addToHistory(
          markAsDone(current as StatefulComponentDefinition),
          createPlanDefinition(message, tasks)
        );
        // Exit after showing plan
        exit(0);
        return null;
      });
    },
    [addToHistory]
  );

  // Initialize configuration flow when not ready
  React.useEffect(() => {
    if (isReady) {
      return;
    }
    setHistory((prevHistory) => {
      // Only initialize if history is empty
      if (prevHistory.length > 0) {
        return prevHistory;
      }
      if (!command) {
        return [createWelcomeDefinition(app)];
      } else {
        return [
          createFeedback(
            FeedbackType.Info,
            'Before I can help with your request, I need to configure a few things:'
          ),
        ];
      }
    });
    setCurrent((prevCurrent) => {
      // Only set config if no current component
      if (prevCurrent) {
        return prevCurrent;
      }
      return createConfigDefinition(handleConfigFinished, handleConfigAborted);
    });
  }, [isReady, app, command, handleConfigFinished, handleConfigAborted]);

  // Execute command when service and command are available
  React.useEffect(() => {
    if (command && service) {
      setCurrent(
        createCommandDefinition(
          command,
          service,
          handleCommandError,
          handleCommandComplete
        )
      );
    }
  }, [command, service, handleCommandError, handleCommandComplete]);

  // Show welcome screen when ready but no command
  React.useEffect(() => {
    if (isReady && !command) {
      setCurrent(createWelcomeDefinition(app));
    }
  }, [isReady, command, app]);

  const items = [...history, ...(current ? [current] : [])];

  return <Column items={items} />;
};
