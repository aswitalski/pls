import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface SetupStatus {
  brewInstalled: boolean;
  ollamaInstalled: boolean;
  ollamaRunning: boolean;
  modelInstalled: boolean;
}

export interface SetupStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export async function checkOllamaStatus(): Promise<SetupStatus> {
  const status: SetupStatus = {
    brewInstalled: false,
    ollamaInstalled: false,
    ollamaRunning: false,
    modelInstalled: false,
  };

  // Check if Homebrew is installed
  try {
    await execAsync('which brew');
    status.brewInstalled = true;
  } catch {
    return status;
  }

  // Check if Ollama is installed
  try {
    await execAsync('which ollama');
    status.ollamaInstalled = true;
  } catch {
    return status;
  }

  // Check if Ollama is running
  try {
    await execAsync('curl -s http://127.0.0.1:11434/api/tags');
    status.ollamaRunning = true;
  } catch {
    return status;
  }

  // Check if model is installed
  try {
    const { stdout } = await execAsync('ollama list');
    status.modelInstalled = stdout.includes('phi3.5');
  } catch {
    // Ignore error
  }

  return status;
}

export function buildSetupPlan(status: SetupStatus): SetupStep[] {
  const steps: SetupStep[] = [];

  if (!status.brewInstalled) {
    steps.push({
      id: 'install-brew',
      description: 'Install Homebrew package manager',
      status: 'pending',
    });
  }

  if (!status.ollamaInstalled) {
    steps.push({
      id: 'install-ollama',
      description: 'Install Ollama via Homebrew',
      status: 'pending',
    });
  }

  if (!status.ollamaRunning) {
    steps.push({
      id: 'start-ollama',
      description: 'Start Ollama service',
      status: 'pending',
    });
  }

  if (!status.modelInstalled) {
    steps.push({
      id: 'pull-model',
      description: 'Download Phi-3.5 Mini model (~2.3GB)',
      status: 'pending',
    });
  }

  return steps;
}

export async function installHomebrew(): Promise<{ success: boolean; error?: string }> {
  try {
    // Install Homebrew using the official installation script
    await execAsync('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to install Homebrew',
    };
  }
}

export async function installOllama(): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to install via Homebrew
    await execAsync('brew install ollama');
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to install Ollama',
    };
  }
}

export async function startOllama(): Promise<{ success: boolean; error?: string }> {
  try {
    // Start Ollama in the background
    exec('ollama serve > /dev/null 2>&1 &');

    // Wait a bit for Ollama to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify it's running
    const status = await checkOllamaStatus();
    if (status.ollamaRunning) {
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Ollama started but is not responding. Please check manually.',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to start Ollama',
    };
  }
}

export async function pullModel(model: string = 'phi3.5:3.8b'): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`ollama pull ${model}`);
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to pull model',
    };
  }
}

export async function executeSetupStep(step: SetupStep): Promise<{ success: boolean; error?: string }> {
  switch (step.id) {
    case 'install-brew':
      return installHomebrew();
    case 'install-ollama':
      return installOllama();
    case 'start-ollama':
      return startOllama();
    case 'pull-model':
      return pullModel();
    default:
      return {
        success: false,
        error: `Unknown step: ${step.id}`,
      };
  }
}
