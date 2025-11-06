import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

import { ConfigureProps } from '../types/components.js';

export function Configure({
  state,
  key: keyProp,
  model: modelProp,
  onComplete,
}: ConfigureProps) {
  const done = state?.done ?? false;
  const [step, setStep] = React.useState<'key' | 'model' | 'done'>(
    state?.step ?? (done ? 'done' : 'key')
  );
  const [key, setKey] = React.useState(keyProp || '');
  const [model, setModel] = React.useState(
    modelProp || 'claude-haiku-4-5-20251001'
  );

  const handleKeySubmit = (value: string) => {
    setKey(value);
    setStep('model');
  };

  const handleModelSubmit = (value: string) => {
    const finalModel = value.trim() || 'claude-haiku-4-5-20251001';
    setModel(finalModel);
    setStep('done');
    if (onComplete) {
      onComplete({ key, model: finalModel });
    }
  };

  return (
    <Box flexDirection="column" marginLeft={1}>
      {!done && <Text>Configuration required.</Text>}
      {!done && (
        <Box>
          <Text color="whiteBright" dimColor>
            {'==>'} Get your API key from: https://platform.claude.com/
          </Text>
        </Box>
      )}
      <Box marginTop={done ? 0 : 1}>
        <Text>Anthropic API key:</Text>
      </Box>
      <Box>
        <Text color="cyan">&gt; </Text>
        {step === 'key' && !done ? (
          <TextInput
            value={key}
            onChange={setKey}
            onSubmit={handleKeySubmit}
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
              Model{' '}
              {!done && (
                <Text dimColor>(default: claude-haiku-4-5-20251001)</Text>
              )}
              :
            </Text>
          </Box>
          <Box>
            <Text color="cyan">&gt; </Text>
            {step === 'model' && !done ? (
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

      {step === 'done' && !done && (
        <Box marginY={1}>
          <Text color="green">✓ Configuration saved</Text>
        </Box>
      )}
    </Box>
  );
}
