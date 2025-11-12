import React from 'react';

import {
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import {
  App,
  ComponentName,
  FeedbackType,
  Task,
  TaskType,
} from '../types/types.js';

import {
  AnthropicService,
  createAnthropicService,
} from '../services/anthropic.js';
import {
  getConfigurationRequiredMessage,
  hasValidAnthropicKey,
  loadConfig,
  saveAnthropicConfig,
} from '../services/config.js';
import {
  createCommandDefinition,
  createConfigDefinition,
  createFeedback,
  createMessage,
  createRefinement,
  createPlanDefinition,
  createWelcomeDefinition,
  getRefiningMessage,
  isStateless,
  markAsDone,
} from '../services/components.js';
import { exitApp } from '../services/process.js';

import { Column } from './Column.js';

interface AnthropicConfig extends Record<string, string> {
  key: string;
  model: string;
}

interface MainProps {
  app: App;
  command: string | null;
}

export const Main = ({ app, command }: MainProps) => {
  // Initialize service from existing config if available
  const [service, setService] = React.useState<AnthropicService | null>(() => {
    if (hasValidAnthropicKey()) {
      const config = loadConfig();
      return createAnthropicService(config.anthropic);
    }
    return null;
  });

  const [timeline, setTimeline] = React.useState<ComponentDefinition[]>([]);
  const [queue, setQueue] = React.useState<ComponentDefinition[]>([]);

  const addToTimeline = React.useCallback((...items: ComponentDefinition[]) => {
    setTimeline((timeline) => [...timeline, ...items]);
  }, []);

  const processNextInQueue = React.useCallback(() => {
    setQueue((currentQueue) => {
      if (currentQueue.length === 0) return currentQueue;

      const [first, ...rest] = currentQueue;

      // Stateless components auto-complete immediately
      if (isStateless(first)) {
        addToTimeline(first);
        return rest;
      }

      return currentQueue;
    });
  }, [addToTimeline]);

  const handleCommandError = React.useCallback(
    (error: string) => {
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;
        if (first.name === ComponentName.Command) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(
              FeedbackType.Failed,
              'Unexpected error occurred:',
              error
            )
          );
        }
        exitApp(1);
        return [];
      });
    },
    [addToTimeline]
  );

  const handleAborted = React.useCallback(
    (operationName: string) => {
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;
        if (!isStateless(first)) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(
              FeedbackType.Aborted,
              `${operationName} was aborted by user`
            )
          );
        }
        exitApp(0);
        return [];
      });
    },
    [addToTimeline]
  );

  const handleConfigAborted = React.useCallback(() => {
    handleAborted('Configuration');
  }, [handleAborted]);

  const handlePlanAborted = React.useCallback(() => {
    handleAborted('Task selection');
  }, [handleAborted]);

  const handleCommandAborted = React.useCallback(() => {
    handleAborted('Request');
  }, [handleAborted]);

  const handleRefinementAborted = React.useCallback(() => {
    handleAborted('Plan refinement');
  }, [handleAborted]);

  const handlePlanSelectionConfirmed = React.useCallback(
    async (selectedTasks: Task[]) => {
      // Mark current plan as done and add refinement to queue
      let refinementDef: StatefulComponentDefinition | null = null;

      refinementDef = createRefinement(
        getRefiningMessage(),
        handleRefinementAborted
      ) as StatefulComponentDefinition;

      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;
        if (first.name === ComponentName.Plan) {
          addToTimeline(markAsDone(first as StatefulComponentDefinition));
        }
        // Add refinement to queue so it becomes the active component
        return [refinementDef!];
      });

      // Process refined command in background
      try {
        const refinedCommand = selectedTasks
          .map((task) => {
            const action = task.action.toLowerCase().replace(/,/g, ' -');
            const type = task.type || 'execute';
            return `${action} (type: ${type})`;
          })
          .join(', ');

        const result = await service!.processWithTool(refinedCommand, 'plan');

        // Mark refinement as done and move to timeline
        setQueue((currentQueue) => {
          if (
            currentQueue.length > 0 &&
            currentQueue[0].id === refinementDef!.id
          ) {
            addToTimeline(
              markAsDone(currentQueue[0] as StatefulComponentDefinition)
            );
          }
          return [];
        });

        // Show final execution plan
        const planDefinition = createPlanDefinition(
          result.message,
          result.tasks,
          handlePlanAborted,
          undefined
        );

        addToTimeline(planDefinition);
        exitApp(0);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        // Mark refinement as done and move to timeline before showing error
        setQueue((currentQueue) => {
          if (
            currentQueue.length > 0 &&
            currentQueue[0].id === refinementDef!.id
          ) {
            addToTimeline(
              markAsDone(currentQueue[0] as StatefulComponentDefinition)
            );
          }
          return [];
        });

        addToTimeline(
          createFeedback(
            FeedbackType.Failed,
            'Unexpected error occurred:',
            errorMessage
          )
        );
        exitApp(1);
      }
    },
    [addToTimeline, service, handleRefinementAborted]
  );

  const handleCommandComplete = React.useCallback(
    (message: string, tasks: Task[]) => {
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first] = currentQueue;

        // Check if tasks contain a Define task that requires user interaction
        const hasDefineTask = tasks.some(
          (task) => task.type === TaskType.Define
        );

        if (first.name === ComponentName.Command) {
          const planDefinition = createPlanDefinition(
            message,
            tasks,
            handlePlanAborted,
            hasDefineTask ? handlePlanSelectionConfirmed : undefined
          );

          if (hasDefineTask) {
            // Don't exit - keep the plan in the queue for interaction
            addToTimeline(markAsDone(first as StatefulComponentDefinition));
            return [planDefinition];
          } else {
            // No define task - add plan to timeline and exit
            addToTimeline(
              markAsDone(first as StatefulComponentDefinition),
              planDefinition
            );
            exitApp(0);
            return [];
          }
        }

        exitApp(0);
        return [];
      });
    },
    [addToTimeline, handlePlanSelectionConfirmed]
  );

  const handleConfigFinished = React.useCallback(
    (config: Record<string, string>) => {
      const anthropicConfig = config as AnthropicConfig;
      saveAnthropicConfig(anthropicConfig);
      const newService = createAnthropicService(anthropicConfig);
      setService(newService);

      // Complete config component and add command if present
      setQueue((currentQueue) => {
        if (currentQueue.length === 0) return currentQueue;
        const [first, ...rest] = currentQueue;
        if (first.name === ComponentName.Config) {
          addToTimeline(
            markAsDone(first as StatefulComponentDefinition),
            createFeedback(FeedbackType.Succeeded, 'Configuration complete')
          );
        }

        // Add command to queue if we have one
        if (command) {
          return [
            ...rest,
            createCommandDefinition(
              command,
              newService,
              handleCommandError,
              handleCommandComplete,
              handleCommandAborted
            ),
          ];
        }

        // No command - exit after showing completion message
        exitApp(0);
        return rest;
      });
    },
    [addToTimeline, command, handleCommandError, handleCommandComplete]
  );

  // Initialize queue on mount
  React.useEffect(() => {
    const hasConfig = !!service;

    if (command && hasConfig) {
      // With command + valid config: [Command]
      setQueue([
        createCommandDefinition(
          command,
          service,
          handleCommandError,
          handleCommandComplete,
          handleCommandAborted
        ),
      ]);
    } else if (command && !hasConfig) {
      // With command + no config: [Message, Config] (Command added after config)
      setQueue([
        createMessage(getConfigurationRequiredMessage()),
        createConfigDefinition(handleConfigFinished, handleConfigAborted),
      ]);
    } else if (!command && hasConfig) {
      // No command + valid config: [Welcome]
      setQueue([createWelcomeDefinition(app)]);
    } else {
      // No command + no config: [Welcome, Message, Config]
      setQueue([
        createWelcomeDefinition(app),
        createMessage(getConfigurationRequiredMessage(true)),
        createConfigDefinition(handleConfigFinished, handleConfigAborted),
      ]);
    }
  }, []); // Only run on mount

  // Process queue whenever it changes
  React.useEffect(() => {
    processNextInQueue();
  }, [queue, processNextInQueue]);

  const current = queue.length > 0 ? queue[0] : null;
  const items = [...timeline, ...(current ? [current] : [])];

  return <Column items={items} />;
};
