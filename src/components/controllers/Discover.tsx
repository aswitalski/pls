import { useEffect, useState } from 'react';

import {
  ComponentStatus,
  DiscoverProps,
  DiscoverState,
} from '../../types/components.js';

import { useInput } from '../../services/keyboard.js';
import { formatErrorMessage } from '../../services/messages.js';
import { ExecuteCommand, RealExecutor } from '../../services/shell.js';
import { formatSystemContext } from '../../services/system.js';
import { withMinimumTime } from '../../services/timing.js';

import { DiscoverView } from '../views/Discover.js';

export { DiscoverView, DiscoverViewProps } from '../views/Discover.js';

const MINIMUM_PROCESSING_TIME = 400;

type DiscoverPhase = 'discovering' | 'executing' | 'done';

/**
 * Discover controller: Discovers and executes shell commands
 */
export function Discover({
  query,
  action,
  status,
  service,
  upcoming,
  requestHandlers,
  lifecycleHandlers,
  workflowHandlers,
}: DiscoverProps) {
  const isActive = status === ComponentStatus.Active;

  const [phase, setPhase] = useState<DiscoverPhase>('discovering');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [command, setCommand] = useState<ExecuteCommand | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  // Handle escape to cancel
  useInput(
    (_input, key) => {
      if (key.escape && isActive) {
        setCancelled(true);
        const finalState: DiscoverState = {
          error: null,
          message: null,
          command: null,
          output: null,
        };
        requestHandlers.onCompleted(finalState);
        requestHandlers.onAborted('discover');
      }
    },
    { isActive }
  );

  // Phase 1: Discover the command
  useEffect(() => {
    if (!isActive || phase !== 'discovering') return;

    let mounted = true;

    async function discover() {
      try {
        // Format the user message with system context
        const systemContext = formatSystemContext(action);
        const userMessage = `${query}\n${systemContext}`;

        const result = await withMinimumTime(
          () => service.processWithTool(userMessage, 'discover'),
          MINIMUM_PROCESSING_TIME
        );

        if (!mounted) return;

        // Add debug components to timeline if present
        if (result.debug?.length) {
          workflowHandlers.addToTimeline(...result.debug);
        }

        setMessage(result.message);
        setCommand(result.command);
        setPhase('executing');
      } catch (err) {
        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);
          const finalState: DiscoverState = {
            error: errorMessage,
            message: null,
            command: null,
            output: null,
          };
          requestHandlers.onCompleted(finalState);
          requestHandlers.onError(errorMessage);
        }
      }
    }

    void discover();

    return () => {
      mounted = false;
    };
  }, [
    isActive,
    phase,
    query,
    action,
    service,
    workflowHandlers,
    requestHandlers,
  ]);

  // Phase 2: Execute the discovered command
  useEffect(() => {
    if (!isActive || phase !== 'executing' || !command) return;

    // Capture command in local variable for TypeScript narrowing
    const commandToExecute = command;
    let mounted = true;

    async function execute() {
      try {
        const executor = new RealExecutor();
        const result = await executor.execute(commandToExecute);

        if (!mounted) return;

        const commandOutput = result.output || result.errors || '';
        setOutput(commandOutput);
        setPhase('done');

        const finalState: DiscoverState = {
          error: null,
          message,
          command,
          output: commandOutput,
        };
        requestHandlers.onCompleted(finalState);
        lifecycleHandlers.completeActive();
      } catch (err) {
        if (mounted) {
          const errorMessage = formatErrorMessage(err);
          setError(errorMessage);
          const finalState: DiscoverState = {
            error: errorMessage,
            message,
            command,
            output: null,
          };
          requestHandlers.onCompleted(finalState);
          requestHandlers.onError(errorMessage);
        }
      }
    }

    void execute();

    return () => {
      mounted = false;
    };
  }, [isActive, phase, command, message, requestHandlers, lifecycleHandlers]);

  return (
    <DiscoverView
      status={status}
      action={action}
      phase={phase}
      message={message}
      command={command}
      output={output}
      error={error}
      upcoming={upcoming}
      cancelled={cancelled}
    />
  );
}
