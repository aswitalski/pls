import { AppError, ErrorCode } from '../types/errors.js';

export enum AnthropicModel {
  Sonnet = 'claude-sonnet-4-5',
  Haiku = 'claude-haiku-4-5',
  Opus = 'claude-opus-4-1',
}

export const SUPPORTED_MODELS = Object.values(AnthropicModel);

export enum DebugLevel {
  None = 'none',
  Info = 'info',
  Verbose = 'verbose',
}

export const SUPPORTED_DEBUG_LEVELS = Object.values(DebugLevel);

export type AnthropicConfig = {
  key: string;
  model?: string;
};

export type SettingsConfig = {
  debug?: DebugLevel;
};

export interface Config {
  anthropic: AnthropicConfig;
  settings?: SettingsConfig;
}

export enum ConfigDefinitionType {
  RegExp = 'regexp',
  String = 'string',
  Enum = 'enum',
  Number = 'number',
  Boolean = 'boolean',
}

/**
 * Base configuration definition with shared properties
 */
interface BaseConfigDefinition {
  required: boolean;
  description: string;
}

/**
 * Configuration definition types - discriminated union for type safety
 */
export type ConfigDefinition =
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.RegExp;
      pattern: RegExp;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.String;
      default?: string;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.Enum;
      values: string[];
      default?: string;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.Number;
      default?: number;
    })
  | (BaseConfigDefinition & {
      type: ConfigDefinitionType.Boolean;
    });

export class ConfigError extends AppError {
  constructor(message: string, origin?: Error) {
    super(message, ErrorCode.MissingConfig, origin);
    this.name = 'ConfigError';
  }
}
