import { randomUUID } from 'node:crypto';

import {
  Capability,
  ComponentDefinition,
  StatefulComponentDefinition,
} from '../types/components.js';
import { App, ComponentName, FeedbackType, Task } from '../types/types.js';

import { LLMService } from './anthropic.js';
import { CommandOutput } from './shell.js';
import { ConfigRequirement } from '../types/skills.js';
import {
  Config,
  ConfigDefinition,
  getConfigSchema,
  loadConfig,
} from './configuration.js';
import { getConfirmationMessage } from './messages.js';

import { ConfigStep, StepType } from '../ui/Config.js';

export function markAsDone<T extends StatefulComponentDefinition>(
  component: T
): T {
  return { ...component, state: { ...component.state, done: true } };
}

export function createWelcomeDefinition(app: App): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Welcome,
    props: { app },
  };
}

export function createConfigSteps(): ConfigStep[] {
  // Use schema-based config step generation for required Anthropic settings
  return createConfigStepsFromSchema(['anthropic.key', 'anthropic.model']);
}

/**
 * Get current config value for a dotted key path
 */
function getConfigValue(config: Config | null, key: string): unknown {
  if (!config) return undefined;

  const parts = key.split('.');
  let value: unknown = config;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Get validation function for a config definition
 */
function getValidator(
  definition: ConfigDefinition
): (value: string) => boolean {
  switch (definition.type) {
    case 'regexp':
      return (value: string) => definition.pattern.test(value);
    case 'string':
      return () => true; // Strings are always valid
    case 'enum':
      return (value: string) => definition.values.includes(value);
    case 'number':
      return (value: string) => !isNaN(Number(value));
    case 'boolean':
      return (value: string) => value === 'true' || value === 'false';
  }
}

/**
 * Create config steps from schema for specified keys
 */
export function createConfigStepsFromSchema(keys: string[]): ConfigStep[] {
  const schema = getConfigSchema();
  let currentConfig: Config | null = null;

  try {
    currentConfig = loadConfig();
  } catch {
    // Config doesn't exist yet, use defaults
  }

  return keys.map((key) => {
    // Check if key is in schema (built-in config)
    if (!(key in schema)) {
      // Key is not in schema - it's from a skill
      // Create a simple text step with placeholder description
      const keyParts = key.split('.');
      const shortKey = keyParts[keyParts.length - 1];
      const description = keyParts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      return {
        description: `${description} {${key}}`,
        key: shortKey,
        type: StepType.Text,
        value: null,
        validate: () => true, // Accept any string for now
      };
    }
    const definition = schema[key];

    const currentValue = getConfigValue(currentConfig, key);
    const keyParts = key.split('.');
    const shortKey = keyParts[keyParts.length - 1];

    // Map definition to ConfigStep based on type
    switch (definition.type) {
      case 'regexp':
      case 'string': {
        const value =
          currentValue !== undefined && typeof currentValue === 'string'
            ? currentValue
            : definition.type === 'string'
              ? (definition.default ?? '')
              : null;

        return {
          description: definition.description,
          key: shortKey,
          type: StepType.Text,
          value,
          validate: getValidator(definition),
        };
      }

      case 'number': {
        const value =
          currentValue !== undefined && typeof currentValue === 'number'
            ? String(currentValue)
            : definition.default !== undefined
              ? String(definition.default)
              : '0';

        return {
          description: definition.description,
          key: shortKey,
          type: StepType.Text,
          value,
          validate: getValidator(definition),
        };
      }

      case 'enum': {
        const currentStr =
          currentValue !== undefined && typeof currentValue === 'string'
            ? currentValue
            : definition.default;

        const defaultIndex = currentStr
          ? definition.values.indexOf(currentStr)
          : 0;

        return {
          description: definition.description,
          key: shortKey,
          type: StepType.Selection,
          options: definition.values.map((value) => ({
            label: value,
            value,
          })),
          defaultIndex: Math.max(0, defaultIndex),
          validate: getValidator(definition),
        };
      }

      case 'boolean': {
        const currentBool =
          currentValue !== undefined && typeof currentValue === 'boolean'
            ? currentValue
            : undefined;

        return {
          description: definition.description,
          key: shortKey,
          type: StepType.Selection,
          options: [
            { label: 'Yes', value: 'true' },
            { label: 'No', value: 'false' },
          ],
          defaultIndex: currentBool !== undefined ? (currentBool ? 0 : 1) : 0,
          validate: getValidator(definition),
        };
      }
    }
  });
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

/**
 * Create config definition with specific keys
 */
export function createConfigDefinitionWithKeys(
  keys: string[],
  onFinished: (config: Record<string, string>) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Config,
    state: { done: false },
    props: {
      steps: createConfigStepsFromSchema(keys),
      onFinished,
      onAborted,
    },
  };
}

export function createCommandDefinition(
  command: string,
  service: LLMService,
  onError: (error: string) => void,
  onComplete: (message: string, tasks: Task[]) => void,
  onAborted: () => void
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
      onAborted,
    },
  };
}

export function createPlanDefinition(
  message: string,
  tasks: Task[],
  onAborted: () => void,
  onSelectionConfirmed?: (tasks: Task[]) => void | Promise<void>
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
      onAborted,
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

export function createRefinement(
  text: string,
  onAborted: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Refinement,
    state: { done: false },
    props: {
      text,
      onAborted,
    },
  };
}

export function createConfirmDefinition(
  onConfirmed: () => void,
  onCancelled: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Confirm,
    state: { done: false },
    props: {
      message: getConfirmationMessage(),
      onConfirmed,
      onCancelled,
    },
  };
}

export function createIntrospectDefinition(
  tasks: Task[],
  service: LLMService,
  onError: (error: string) => void,
  onComplete: (message: string, capabilities: Capability[]) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Introspect,
    state: {
      done: false,
      isLoading: true,
    },
    props: {
      tasks,
      service,
      onError,
      onComplete,
      onAborted,
    },
  };
}

export function createReportDefinition(
  message: string,
  capabilities: Capability[]
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Report,
    props: {
      message,
      capabilities,
    },
  };
}

export function createAnswerDefinition(
  question: string,
  service: LLMService,
  onError: (error: string) => void,
  onComplete: (answer: string) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Answer,
    state: {
      done: false,
      isLoading: true,
    },
    props: {
      question,
      service,
      onError,
      onComplete,
      onAborted,
    },
  };
}

export function createAnswerDisplayDefinition(
  answer: string
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.AnswerDisplay,
    props: {
      answer,
    },
  };
}

export function isStateless(component: ComponentDefinition): boolean {
  return !('state' in component);
}

export function createExecuteDefinition(
  tasks: Task[],
  service: LLMService,
  onError: (error: string) => void,
  onComplete: (outputs: CommandOutput[], totalElapsed: number) => void,
  onAborted: (elapsedTime: number) => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Execute,
    state: {
      done: false,
      isLoading: true,
    },
    props: {
      tasks,
      service,
      onError,
      onComplete,
      onAborted,
    },
  };
}

export function createValidateDefinition(
  missingConfig: ConfigRequirement[],
  userRequest: string,
  service: LLMService,
  onError: (error: string) => void,
  onComplete: (configWithDescriptions: ConfigRequirement[]) => void,
  onAborted: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Validate,
    state: {
      done: false,
      isLoading: true,
    },
    props: {
      missingConfig,
      userRequest,
      service,
      onError,
      onComplete,
      onAborted,
    },
  };
}
