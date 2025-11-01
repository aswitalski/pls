import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { checkOllamaStatus, buildSetupPlan, executeSetupStep } from '../setup/ollama-setup.js';
import { Welcome } from './Welcome.js';
import enquirer from 'enquirer';

const { Confirm } = enquirer;

export function SetupPlan({ onComplete, onSkip, versionInfo }) {
  const [steps, setSteps] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);

  useEffect(() => {
    const checkAndBuildPlan = async () => {
      const status = await checkOllamaStatus();
      const plan = buildSetupPlan(status);

      if (plan.length === 0) {
        // Everything is already set up
        onComplete();
      } else {
        setSteps(plan);
        setLoading(false);
      }
    };

    checkAndBuildPlan();
  }, []);

  useEffect(() => {
    const askConfirmation = async () => {
      if (!loading && steps.length > 0 && !confirmed && !waitingForConfirmation) {
        // Give Ink time to render the plan
        await new Promise(resolve => setTimeout(resolve, 500));

        setWaitingForConfirmation(true);

        const prompt = new Confirm({
          name: 'proceed',
          message: 'Press Enter to continue or Esc to cancel.',
          initial: true,
        });

        try {
          const answer = await prompt.run();
          if (answer) {
            setConfirmed(true);
            setWaitingForConfirmation(false);
          } else {
            onSkip();
          }
        } catch (error) {
          onSkip();
        }
      }
    };

    askConfirmation();
  }, [loading, steps]);

  useEffect(() => {
    if (confirmed && !executing) {
      executeAllSteps();
    }
  }, [confirmed]);

  const executeAllSteps = async () => {
    setExecuting(true);

    for (let i = 0; i < steps.length; i++) {
      // Update step to running
      setSteps(prev => {
        const newSteps = [...prev];
        newSteps[i] = { ...newSteps[i], status: 'running' };
        return newSteps;
      });

      // Execute the step
      const result = await executeSetupStep(steps[i]);

      // Update step to completed or failed
      setSteps(prev => {
        const newSteps = [...prev];
        newSteps[i] = {
          ...newSteps[i],
          status: result.success ? 'completed' : 'failed',
          error: result.error,
        };
        return newSteps;
      });

      // If failed, stop execution
      if (!result.success) {
        setExecuting(false);
        return;
      }
    }

    setExecuting(false);

    // All steps completed successfully
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  if (loading) {
    return (
      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        <Welcome versionInfo={versionInfo} />
        <Box padding={1}>
          <Text color="cyan">⏳ Checking system requirements...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Welcome versionInfo={versionInfo} />
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="yellow" bold>⚙ Setup Required</Text>
        </Box>

      <Box marginBottom={1}>
        <Text bold>The following steps are needed:</Text>
      </Box>

      {steps.map((step, index) => {
        const getIcon = () => {
          if (step.status === 'completed') return '✓';
          if (step.status === 'failed') return '✗';
          if (step.status === 'running') return '→';
          return `${index + 1}.`;
        };

        const getColor = () => {
          if (step.status === 'completed') return 'green';
          if (step.status === 'failed') return 'red';
          if (step.status === 'running') return 'green';
          return 'white';
        };

        return (
          <Box key={step.id} marginLeft={2} marginBottom={step.error ? 1 : 0}>
            {step.status === 'pending' ? (
              <>
                <Text color="whiteBright">{getIcon()} </Text>
                <Text color="white">{step.description}</Text>
              </>
            ) : (
              <Text color={getColor()} dimColor={step.status === 'completed'} bold={step.status === 'running'}>
                {getIcon()} {step.description}
              </Text>
            )}
            {step.error && (
              <Box marginLeft={3}>
                <Text color="red"> Error: {step.error}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {executing && (
        <Box marginTop={1}>
          <Text color="cyan">⏳ Executing setup...</Text>
        </Box>
      )}
      </Box>
    </Box>
  );
}
