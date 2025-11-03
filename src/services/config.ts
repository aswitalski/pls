import { existsSync, mkdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface Config {
  claudeApiKey?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const CONFIG_DIR = join(homedir(), '.pls');
const CONFIG_FILE = join(CONFIG_DIR, '.env');

export function ensureConfigDirectory(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

export function loadConfig(): Config {
  ensureConfigDirectory();

  if (!existsSync(CONFIG_FILE)) {
    throw new ConfigError(
      `Configuration file not found at ${CONFIG_FILE}\n` +
        'Please create it with your CLAUDE_API_KEY.\n' +
        'Example: echo "CLAUDE_API_KEY=sk-ant-..." > ~/.pls/.env'
    );
  }

  const content = readFileSync(CONFIG_FILE, 'utf-8');
  const parsed = parseEnvFile(content);

  const claudeApiKey = parsed.CLAUDE_API_KEY;

  if (!claudeApiKey) {
    throw new ConfigError(
      'CLAUDE_API_KEY not found in configuration file.\n' +
        `Please add it to ${CONFIG_FILE}`
    );
  }

  return {
    claudeApiKey,
  };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
