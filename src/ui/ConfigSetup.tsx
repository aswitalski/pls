import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ConfigSetupProps {
  onComplete: (config: { apiKey: string; model: string }) => void;
}

export function ConfigSetup({ onComplete }: ConfigSetupProps) {
  const [step, setStep] = React.useState<'api-key' | 'model' | 'done'>(
    'api-key'
  );
  const [apiKey, setApiKey] = React.useState('');
  const [model, setModel] = React.useState('claude-haiku-4-5-20251001');

  const handleApiKeySubmit = (value: string) => {
    setApiKey(value);
    setStep('model');
  };

  const handleModelSubmit = (value: string) => {
    const finalModel = value.trim() || 'claude-haiku-4-5-20251001';
    setModel(finalModel);
    setStep('done');
    onComplete({ apiKey, model: finalModel });
  };

  return (
    <Box flexDirection="column" marginLeft={1}>
      <Text>Configuration required.</Text>
      <Box>
        <Text color="whiteBright" dimColor>
          {"==>"} Get your API key from: https://platform.claude.com/
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>Anthropic API key:</Text>
      </Box>
      <Box>
        <Text color="cyan">&gt; </Text>
        {step === 'api-key' ? (
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={handleApiKeySubmit}
            mask="*"
          />
        ) : (
          <Text dimColor>{'*'.repeat(12)}</Text>
        )}
      </Box>

      {(step === 'model' || step === 'done') && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>
              Model <Text dimColor>(default: claude-haiku-4-5-20251001)</Text>:
            </Text>
          </Box>
          <Box>
            <Text color="cyan">&gt; </Text>
            {step === 'model' ? (
              <TextInput
                value={model}
                onChange={setModel}
                onSubmit={handleModelSubmit}
              />
            ) : (
              <Text dimColor>{model}</Text>
            )}
          </Box>
        </Box>
      )}

      {step === 'done' && (
        <Box marginY={1}>
          <Text color="green">✓ Configuration saved</Text>
        </Box>
      )}
    </Box>
  );
}
