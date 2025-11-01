import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import { askQuestion } from '../llm/ollama.js';
import { checkOllamaStatus, buildSetupPlan } from '../setup/ollama-setup.js';
import { SetupPlan } from './SetupPlan.js';
import { Welcome } from './Welcome.js';

export function Please({ question, versionInfo }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    const fetchAnswer = async () => {
      setLoading(true);
      const answer = await askQuestion(question);

      // If there's an error, check if setup is needed
      if (answer.error) {
        const status = await checkOllamaStatus();
        const plan = buildSetupPlan(status);

        if (plan.length > 0) {
          setNeedsSetup(true);
          setLoading(false);
        } else {
          setResult(answer);
          setLoading(false);
        }
      } else {
        setResult(answer);
        setLoading(false);
      }
    };

    fetchAnswer();
  }, [question]);

  useEffect(() => {
    if (setupComplete) {
      // Retry the question after setup is complete
      const retryQuestion = async () => {
        setLoading(true);
        setNeedsSetup(false);
        const answer = await askQuestion(question);
        setResult(answer);
        setLoading(false);
      };

      retryQuestion();
    }
  }, [setupComplete, question]);

  const handleSetupComplete = () => {
    setSetupComplete(true);
  };

  const handleSetupSkip = () => {
    setNeedsSetup(false);
    setResult({ error: 'Setup cancelled by user' });
    setLoading(false);
    process.exit(0);
  };

  if (needsSetup) {
    return <SetupPlan onComplete={handleSetupComplete} onSkip={handleSetupSkip} versionInfo={versionInfo} />;
  }

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Welcome versionInfo={versionInfo} />

      <Box marginBottom={1}>
        <Text bold>Question: </Text>
        <Text>{question}</Text>
      </Box>

      {loading && (
        <Box>
          <Text color="cyan">⏳ Thinking...</Text>
        </Box>
      )}

      {!loading && result?.error && (
        <Box flexDirection="column">
          <Text color="red">✗ {result.error}</Text>
        </Box>
      )}

      {!loading && result?.answer && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Answer:</Text>
          </Box>
          <Box paddingLeft={2}>
            <Text>{result.answer}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
