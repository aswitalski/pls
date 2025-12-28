import {
  AnthropicConfig,
  AnthropicModel,
  Config,
  ConfigError,
  DebugLevel,
  SUPPORTED_DEBUG_LEVELS,
  SUPPORTED_MODELS,
} from './types.js';

export function validateConfig(parsed: unknown): Config {
  if (!parsed || typeof parsed !== 'object') {
    throw new ConfigError('Invalid configuration format');
  }

  const config = parsed as Record<string, unknown>;

  // Validate anthropic section
  if (!config.anthropic || typeof config.anthropic !== 'object') {
    throw new ConfigError('Missing or invalid anthropic configuration');
  }

  const { key, model } = config.anthropic as AnthropicConfig;

  if (!key || typeof key !== 'string') {
    throw new ConfigError('Missing or invalid API key');
  }

  const validatedConfig: Config = {
    anthropic: {
      key,
    },
  };

  // Optional model - only set if valid
  if (model && typeof model === 'string' && isValidAnthropicModel(model)) {
    validatedConfig.anthropic.model = model;
  }

  // Optional settings section
  if (config.settings && typeof config.settings === 'object') {
    const settings = config.settings as Record<string, unknown>;
    validatedConfig.settings = {};

    if ('debug' in settings) {
      // Handle migration from boolean to enum
      if (typeof settings.debug === 'boolean') {
        validatedConfig.settings.debug = settings.debug
          ? DebugLevel.Info
          : DebugLevel.None;
      } else if (
        typeof settings.debug === 'string' &&
        SUPPORTED_DEBUG_LEVELS.includes(settings.debug as DebugLevel)
      ) {
        validatedConfig.settings.debug = settings.debug as DebugLevel;
      }
    }
  }

  return validatedConfig;
}

export function isValidAnthropicApiKey(key: string): boolean {
  // Anthropic API keys format: sk-ant-api03-XXXXX (108 chars total)
  // - Prefix: sk-ant-api03- (13 chars)
  // - Key body: 95 characters (uppercase, lowercase, digits, hyphens, underscores)
  const apiKeyPattern = /^sk-ant-api03-[A-Za-z0-9_-]{95}$/;
  return apiKeyPattern.test(key);
}

export function isValidAnthropicModel(model: string): boolean {
  return SUPPORTED_MODELS.includes(model as AnthropicModel);
}
