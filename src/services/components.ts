import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { App, ComponentName, FeedbackType, Task } from '../types/types.js';
import { ConfigRequirement } from '../types/skills.js';
import {
  AnswerDefinitionProps,
  Capability,
  CommandDefinitionProps,
  ComponentDefinition,
  ComponentStatus,
  ConfigDefinitionProps,
  ConfirmDefinitionProps,
  ExecuteDefinitionProps,
  IntrospectDefinitionProps,
  PlanDefinitionProps,
  RefinementDefinitionProps,
  ValidateDefinitionProps,
} from '../types/components.js';

import { parse as parseYaml } from 'yaml';

import { LLMService } from './anthropic.js';
import {
  Config,
  ConfigDefinition,
  ConfigDefinitionType,
  getConfigPath,
  getConfigSchema,
  loadConfig,
} from './configuration.js';
import { getConfirmationMessage } from './messages.js';

import { ConfigStep, StepType } from '../ui/Config.js';

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
function getConfigValue(
  config: Config | Record<string, unknown> | null,
  key: string
): unknown {
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
    case ConfigDefinitionType.RegExp:
      return (value: string) => definition.pattern.test(value);
    case ConfigDefinitionType.String:
      return () => true; // Strings are always valid
    case ConfigDefinitionType.Enum:
      return (value: string) => definition.values.includes(value);
    case ConfigDefinitionType.Number:
      return (value: string) => !isNaN(Number(value));
    case ConfigDefinitionType.Boolean:
      return (value: string) => value === 'true' || value === 'false';
  }
}

/**
 * Create config steps from schema for specified keys
 */
export function createConfigStepsFromSchema(keys: string[]): ConfigStep[] {
  const schema = getConfigSchema();
  let currentConfig: Config | null = null;
  let rawConfig: Record<string, unknown> | null = null;

  // Load validated config (may fail if config has validation errors)
  try {
    currentConfig = loadConfig();
  } catch {
    // Config doesn't exist or has validation errors, use defaults
  }

  // Load raw config separately (for discovered keys not in schema)
  try {
    const configFile = getConfigPath();
    if (existsSync(configFile)) {
      const content = readFileSync(configFile, 'utf-8');
      rawConfig = parseYaml(content) as Record<string, unknown>;
    }
  } catch {
    // Config file doesn't exist or can't be parsed
  }

  return keys.map((key) => {
    // Check if key is in schema (built-in config)
    if (!(key in schema)) {
      // Key is not in schema - it's from a skill or discovered config
      // Create a simple text step with the full path as description
      const keyParts = key.split('.');
      const shortKey = keyParts[keyParts.length - 1];

      // Load current value if it exists (use rawConfig since discovered keys aren't in validated config)
      const currentValue = getConfigValue(rawConfig, key);
      const value =
        currentValue !== undefined && typeof currentValue === 'string'
          ? currentValue
          : null;

      return {
        description: key,
        key: shortKey,
        path: key,
        type: StepType.Text,
        value,
        validate: () => true, // Accept any string for now
      };
    }
    const definition = schema[key];

    const currentValue = getConfigValue(currentConfig, key);
    const keyParts = key.split('.');
    const shortKey = keyParts[keyParts.length - 1];

    // Map definition to ConfigStep based on type
    switch (definition.type) {
      case ConfigDefinitionType.RegExp:
      case ConfigDefinitionType.String: {
        const value =
          currentValue !== undefined && typeof currentValue === 'string'
            ? currentValue
            : definition.type === ConfigDefinitionType.String
              ? (definition.default ?? '')
              : null;

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Text,
          value,
          validate: getValidator(definition),
        };
      }

      case ConfigDefinitionType.Number: {
        const value =
          currentValue !== undefined && typeof currentValue === 'number'
            ? String(currentValue)
            : definition.default !== undefined
              ? String(definition.default)
              : '0';

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Text,
          value,
          validate: getValidator(definition),
        };
      }

      case ConfigDefinitionType.Enum: {
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
          path: key,
          type: StepType.Selection,
          options: definition.values.map((value) => ({
            label: value,
            value,
          })),
          defaultIndex: Math.max(0, defaultIndex),
          validate: getValidator(definition),
        };
      }

      case ConfigDefinitionType.Boolean: {
        const currentBool =
          currentValue !== undefined && typeof currentValue === 'boolean'
            ? currentValue
            : undefined;

        return {
          description: definition.description,
          key: shortKey,
          path: key,
          type: StepType.Selection,
          options: [
            { label: 'yes', value: 'true' },
            { label: 'no', value: 'false' },
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
  onAborted: (operation: string) => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Config,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      steps: createConfigSteps(),
      onFinished,
      onAborted,
    } satisfies ConfigDefinitionProps,
  };
}

/**
 * Create config definition with specific keys
 */
export function createConfigDefinitionWithKeys(
  keys: string[],
  onFinished: (config: Record<string, string>) => void,
  onAborted: (operation: string) => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Config,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      steps: createConfigStepsFromSchema(keys),
      onFinished,
      onAborted,
    } satisfies ConfigDefinitionProps,
  };
}

export function createCommandDefinition(
  command: string,
  service: LLMService
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Command,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      command,
      service,
    } satisfies CommandDefinitionProps,
  };
}

export function createPlanDefinition(
  message: string,
  tasks: Task[],
  onSelectionConfirmed?: (tasks: Task[]) => void | Promise<void>
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Plan,
    status: ComponentStatus.Awaiting,
    state: {
      highlightedIndex: null,
      currentDefineGroupIndex: 0,
      completedSelections: [],
    },
    props: {
      message,
      tasks,
      onSelectionConfirmed,
    } satisfies PlanDefinitionProps,
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

export function createDebugDefinition(
  title: string,
  content: string,
  color: string
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Debug,
    props: {
      title,
      content,
      color,
    },
  };
}

export function createRefinement(
  text: string,
  onAborted: (operation: string) => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Refinement,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      text,
      onAborted,
    } satisfies RefinementDefinitionProps,
  };
}

export function createConfirmDefinition(
  onConfirmed: () => void,
  onCancelled: () => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Confirm,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      message: getConfirmationMessage(),
      onConfirmed,
      onCancelled,
    } satisfies ConfirmDefinitionProps,
  };
}

export function createIntrospectDefinition(
  tasks: Task[],
  service: LLMService
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Introspect,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      tasks,
      service,
    } satisfies IntrospectDefinitionProps,
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
  service: LLMService
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Answer,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      question,
      service,
    } satisfies AnswerDefinitionProps,
  };
}

export function isStateless(component: ComponentDefinition): boolean {
  return !('state' in component);
}

/**
 * Mark a component as done. Returns the component to be added to timeline.
 * Components use handlers.updateState to save their state before completion,
 * so this function sets the status to Done and returns the updated component.
 */
export function markAsDone(
  component: ComponentDefinition
): ComponentDefinition {
  return { ...component, status: ComponentStatus.Done };
}

export function createExecuteDefinition(
  tasks: Task[],
  service: LLMService
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Execute,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      tasks,
      service,
    } satisfies ExecuteDefinitionProps,
  };
}

export function createValidateDefinition(
  missingConfig: ConfigRequirement[],
  userRequest: string,
  service: LLMService,
  onError: (error: string) => void,
  onComplete: (configWithDescriptions: ConfigRequirement[]) => void,
  onAborted: (operation: string) => void
): ComponentDefinition {
  return {
    id: randomUUID(),
    name: ComponentName.Validate,
    status: ComponentStatus.Awaiting,
    state: {},
    props: {
      missingConfig,
      userRequest,
      service,
      onError,
      onComplete,
      onAborted,
    } satisfies ValidateDefinitionProps,
  };
}
