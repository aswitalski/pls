import { useEffect, useState } from 'react';
import { Box, Text, useFocus } from 'ink';
import TextInput from 'ink-text-input';

import {
  ComponentStatus,
  LearnPhase,
  LearnState,
  LearnStepPair,
} from '../../types/components.js';

import { Colors, Palette } from '../../services/colors.js';
import { useInput } from '../../services/keyboard.js';
import { configEntriesToYaml } from '../../services/skills.js';

const YES_NO_OPTIONS = [
  { label: 'yes', value: true },
  { label: 'no', value: false },
];

function ValidationMessage({ message }: { message: string }) {
  return (
    <Box marginTop={1} minWidth={40}>
      <Text color={Colors.Status.Warning}>{message}.</Text>
    </Box>
  );
}

// Phase ordering for visibility logic
const PHASE_ORDER = [
  LearnPhase.Name,
  LearnPhase.Description,
  LearnPhase.Aliases,
  LearnPhase.AliasMore,
  LearnPhase.Config,
  LearnPhase.ConfigMore,
  LearnPhase.StepDescription,
  LearnPhase.StepExecutionType,
  LearnPhase.StepExecutionValue,
  LearnPhase.StepMore,
  LearnPhase.Review,
];

function createPhaseHelpers(current: LearnPhase) {
  const currentIndex = PHASE_ORDER.indexOf(current);
  return {
    isPast: (target: LearnPhase) => currentIndex > PHASE_ORDER.indexOf(target),
    isInRange: (start: LearnPhase, end: LearnPhase) =>
      currentIndex >= PHASE_ORDER.indexOf(start) &&
      currentIndex < PHASE_ORDER.indexOf(end),
  };
}

const EXECUTION_TYPE_OPTIONS = [
  { label: 'shell command', value: 'command' },
  { label: 'reference existing skill', value: 'reference' },
];

interface TextInputStepProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

function TextInputStep({
  value,
  placeholder,
  onChange,
  onSubmit,
}: TextInputStepProps) {
  const [inputValue, setInputValue] = useState(value);
  const { isFocused } = useFocus({ autoFocus: true });

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
  };

  return (
    <Box>
      <Text color={Colors.Action.Select}>&gt;</Text>
      <Text> </Text>
      {isFocused ? (
        <TextInput
          value={inputValue}
          onChange={handleChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
        />
      ) : (
        <Text dimColor>{inputValue || placeholder}</Text>
      )}
    </Box>
  );
}

interface SelectionStepProps {
  options: Array<{ label: string; value: unknown }>;
  selectedIndex: number;
  isActive: boolean;
}

function SelectionStep({
  options,
  selectedIndex,
  isActive,
}: SelectionStepProps) {
  return (
    <Box>
      <Text color={Colors.Action.Select}>&gt;</Text>
      <Text> </Text>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={option.label} marginRight={2}>
            <Text
              color={isSelected && isActive ? Palette.Green : undefined}
              dimColor={!isSelected}
              bold={isSelected}
            >
              {option.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

interface SkillSelectionStepProps {
  skills: string[];
  selectedIndex: number;
  isActive: boolean;
}

function SkillSelectionStep({
  skills,
  selectedIndex,
}: SkillSelectionStepProps) {
  if (skills.length === 0) {
    return (
      <Box>
        <Text color={Colors.Action.Select}>&gt;</Text>
        <Text> </Text>
        <Text dimColor>no skills available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {skills.map((skill, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={skill}>
            <Text color={Colors.Action.Select}>{isSelected ? '>' : ' '}</Text>
            <Text> </Text>
            <Text
              color={isSelected ? undefined : Palette.LightGray}
              bold={isSelected}
            >
              {skill}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

function CompletedValue({ value }: { value: string }) {
  return (
    <Box>
      <Text color={Colors.Action.Select} dimColor>
        &gt;
      </Text>
      <Text> </Text>
      <Text dimColor>{value}</Text>
    </Box>
  );
}

interface CompletedStepProps {
  index: number;
  description: string;
  executionType: 'command' | 'reference';
  execution: string;
}

function CompletedStep({
  index,
  description,
  executionType,
  execution,
}: CompletedStepProps) {
  const executionValue =
    executionType === 'reference' ? `[ ${execution} ]` : execution;
  return (
    <Box flexDirection="column">
      <Text dimColor>
        Step {index}: {description}
      </Text>
      <CompletedValue value={executionValue} />
    </Box>
  );
}

interface WizardHeaderProps {
  name: string | null;
  description?: string | null;
  aliases?: string[];
  configEntries?: string[];
  stepPairs?: LearnStepPair[];
  showDescription?: boolean;
  showAliases?: boolean;
  showConfig?: boolean;
  showSteps?: boolean;
}

function WizardHeader({
  name,
  description,
  aliases = [],
  configEntries = [],
  stepPairs = [],
  showDescription = false,
  showAliases = false,
  showConfig = false,
  showSteps = false,
}: WizardHeaderProps) {
  return (
    <>
      <Text color={Colors.Action.Execute}>Creating a new skill...</Text>
      <Box flexDirection="column">
        <Text dimColor>Name:</Text>
        <CompletedValue value={name || ''} />
      </Box>
      {showDescription && (
        <Box flexDirection="column">
          <Text dimColor>Description:</Text>
          <CompletedValue value={description || ''} />
        </Box>
      )}
      {showAliases && (
        <Box flexDirection="column">
          <Text dimColor>Aliases:</Text>
          {aliases.length > 0 ? (
            aliases.map((alias, i) => <CompletedValue key={i} value={alias} />)
          ) : (
            <Text dimColor> (none)</Text>
          )}
        </Box>
      )}
      {showConfig && (
        <Box flexDirection="column">
          <Text dimColor>Config:</Text>
          {configEntries.length > 0 ? (
            configEntries.map((entry, i) => (
              <CompletedValue key={i} value={entry} />
            ))
          ) : (
            <Text dimColor> (none)</Text>
          )}
        </Box>
      )}
      {showSteps &&
        stepPairs.map((pair, i) => (
          <CompletedStep
            key={i}
            index={i + 1}
            description={pair.description}
            executionType={pair.executionType}
            execution={pair.execution}
          />
        ))}
    </>
  );
}

interface PreviewProps {
  name: string;
  description: string;
  aliases: string[];
  configEntries: string[];
  stepPairs: LearnStepPair[];
}

function Preview({
  name,
  description,
  aliases,
  configEntries,
  stepPairs,
}: PreviewProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={Palette.Gray}
      paddingY={1}
      paddingX={2}
      gap={1}
      minWidth={60}
    >
      <Box flexDirection="column">
        <Text bold color={Palette.Cyan}>
          ### Name
        </Text>
        <Text>{name}</Text>
      </Box>
      <Box flexDirection="column">
        <Text bold color={Palette.Cyan}>
          ### Description
        </Text>
        <Text>{description}</Text>
      </Box>
      {aliases.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={Palette.Cyan}>
            ### Aliases
          </Text>
          {aliases.map((alias, i) => (
            <Text key={i}>- {alias}</Text>
          ))}
        </Box>
      )}
      {configEntries.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={Palette.Cyan}>
            ### Config
          </Text>
          <Text>{configEntriesToYaml(configEntries).trimEnd()}</Text>
        </Box>
      )}
      <Box flexDirection="column">
        <Text bold color={Palette.Cyan}>
          ### Steps
        </Text>
        {stepPairs.map((pair, i) => (
          <Text key={i}>- {pair.description}</Text>
        ))}
      </Box>
      <Box flexDirection="column">
        <Text bold color={Palette.Cyan}>
          ### Execution
        </Text>
        {stepPairs.map((pair, i) => (
          <Text key={i}>
            -{' '}
            {pair.executionType === 'reference'
              ? `[ ${pair.execution} ]`
              : pair.execution}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

export interface LearnViewProps {
  state: LearnState;
  status: ComponentStatus;
  onInputChange: (value: string) => void;
  onInputSubmit: (value: string) => void;
}

export const LearnView = ({
  state,
  status,
  onInputChange,
  onInputSubmit,
}: LearnViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const {
    name,
    description,
    aliases,
    configEntries,
    stepPairs,
    currentPhase,
    inputValue,
    selectedIndex,
    error,
    availableSkills,
    pendingStepDescription,
  } = state;

  // Prevent keyboard input when not active
  useInput(() => {}, { isActive: false });

  const headerProps = {
    name,
    description,
    aliases,
    configEntries,
    stepPairs,
  };

  // Show section if we've moved past where it was entered
  const { isPast, isInRange } = createPhaseHelpers(currentPhase);
  const showDescription = isPast(LearnPhase.Description);
  const showAliases = isPast(LearnPhase.AliasMore);
  const showConfig = isPast(LearnPhase.ConfigMore);
  const showSteps = isInRange(LearnPhase.StepDescription, LearnPhase.Review);

  const isReference = state.pendingExecutionType === 'reference';

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case LearnPhase.Name:
        return (
          <Box flexDirection="column">
            <Text>Name:</Text>
            <TextInputStep
              key="name"
              value={inputValue}
              onChange={onInputChange}
              onSubmit={onInputSubmit}
            />
            {error && <ValidationMessage message={error} />}
          </Box>
        );

      case LearnPhase.Description:
        return (
          <Box flexDirection="column">
            <Text>Description (min 20 characters):</Text>
            <TextInputStep
              key="description"
              value={inputValue}
              onChange={onInputChange}
              onSubmit={onInputSubmit}
            />
            {error && <ValidationMessage message={error} />}
          </Box>
        );

      case LearnPhase.Aliases:
        return (
          <>
            {aliases.length > 0 && (
              <Box flexDirection="column">
                <Text dimColor>Aliases:</Text>
                {aliases.map((alias, i) => (
                  <CompletedValue key={i} value={alias} />
                ))}
              </Box>
            )}
            <Box flexDirection="column">
              <Text>
                {aliases.length === 0
                  ? 'Alias (Enter to skip):'
                  : 'Another alias (Enter to skip):'}
              </Text>
              <TextInputStep
                key={`alias-${aliases.length}`}
                value={inputValue}
                placeholder="e.g. deploy to prod"
                onChange={onInputChange}
                onSubmit={onInputSubmit}
              />
            </Box>
          </>
        );

      case LearnPhase.AliasMore:
        return (
          <>
            <Box flexDirection="column">
              <Text dimColor>Aliases:</Text>
              {aliases.map((alias, i) => (
                <CompletedValue key={i} value={alias} />
              ))}
            </Box>
            <Box flexDirection="column">
              <Text>Add another alias?</Text>
              <SelectionStep
                key="alias-more"
                options={YES_NO_OPTIONS}
                selectedIndex={selectedIndex}
                isActive={isActive}
              />
            </Box>
          </>
        );

      case LearnPhase.Config:
        return (
          <>
            {configEntries.length > 0 && (
              <Box flexDirection="column">
                <Text dimColor>Config:</Text>
                {configEntries.map((entry, i) => (
                  <CompletedValue key={i} value={entry} />
                ))}
              </Box>
            )}
            <Box flexDirection="column">
              <Text>
                {configEntries.length === 0
                  ? 'Config (Enter to skip):'
                  : 'Another config (Enter to skip):'}
              </Text>
              <TextInputStep
                key={`config-${configEntries.length}`}
                value={inputValue}
                placeholder="e.g. server.production.url: string"
                onChange={onInputChange}
                onSubmit={onInputSubmit}
              />
              {error && <ValidationMessage message={error} />}
            </Box>
          </>
        );

      case LearnPhase.ConfigMore:
        return (
          <>
            <Box flexDirection="column">
              <Text dimColor>Config:</Text>
              {configEntries.map((entry, i) => (
                <CompletedValue key={i} value={entry} />
              ))}
            </Box>
            <Box flexDirection="column">
              <Text>Add another configuration entry?</Text>
              <SelectionStep
                key="config-more"
                options={YES_NO_OPTIONS}
                selectedIndex={selectedIndex}
                isActive={isActive}
              />
            </Box>
          </>
        );

      case LearnPhase.StepDescription:
        return (
          <Box flexDirection="column">
            {stepPairs.length === 0 && (
              <Text>Step 1 - What does this step do?</Text>
            )}
            <TextInputStep
              key={`step-desc-${stepPairs.length}`}
              value={inputValue}
              placeholder={
                stepPairs.length === 0
                  ? name || undefined
                  : `Describe step ${stepPairs.length + 1}`
              }
              onChange={onInputChange}
              onSubmit={onInputSubmit}
            />
            {error && <ValidationMessage message={error} />}
          </Box>
        );

      case LearnPhase.StepExecutionType:
        return (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>
              Step {stepPairs.length + 1}: {inputValue}
            </Text>
            <Box flexDirection="column" marginLeft={2}>
              <Text>How should this step be executed?</Text>
              <SelectionStep
                key={`step-type-${stepPairs.length}`}
                options={EXECUTION_TYPE_OPTIONS}
                selectedIndex={selectedIndex}
                isActive={isActive}
              />
            </Box>
          </Box>
        );

      case LearnPhase.StepExecutionValue:
        return (
          <Box flexDirection="column" gap={1}>
            <Text dimColor>
              Step {stepPairs.length + 1}: {pendingStepDescription}
            </Text>
            <Box flexDirection="column" marginLeft={2}>
              {isReference ? (
                <>
                  <Box marginBottom={1}>
                    <Text>Select skill to reference:</Text>
                  </Box>
                  <SkillSelectionStep
                    key={`step-ref-${stepPairs.length}`}
                    skills={availableSkills}
                    selectedIndex={selectedIndex}
                    isActive={isActive}
                  />
                </>
              ) : (
                <>
                  <Text>Enter the shell command:</Text>
                  <TextInputStep
                    key={`step-exec-${stepPairs.length}`}
                    value={inputValue}
                    placeholder="e.g. npm install"
                    onChange={onInputChange}
                    onSubmit={onInputSubmit}
                  />
                </>
              )}
              {error && <ValidationMessage message={error} />}
            </Box>
          </Box>
        );

      case LearnPhase.StepMore:
        return (
          <Box flexDirection="column">
            <Text>Add another step?</Text>
            <SelectionStep
              key={`step-more-${stepPairs.length}`}
              options={YES_NO_OPTIONS}
              selectedIndex={selectedIndex}
              isActive={isActive}
            />
          </Box>
        );

      case LearnPhase.Review:
        return null; // Review has its own layout

      default:
        return null;
    }
  };

  // Name phase has its own layout (no header yet)
  if (currentPhase === LearnPhase.Name) {
    return (
      <Box flexDirection="column" marginLeft={1} gap={1}>
        <Text color={Colors.Action.Execute}>Creating a new skill...</Text>
        {renderPhaseContent()}
      </Box>
    );
  }

  // Review phase has a different layout
  if (currentPhase === LearnPhase.Review) {
    return (
      <Box flexDirection="column" marginLeft={1} gap={1}>
        <Text>Review your new skill:</Text>
        <Preview
          name={name || ''}
          description={description || ''}
          aliases={aliases}
          configEntries={configEntries}
          stepPairs={stepPairs}
        />
        <Box flexDirection="column">
          <Text>Save this skill?</Text>
          <SelectionStep
            key="review-save"
            options={YES_NO_OPTIONS}
            selectedIndex={selectedIndex}
            isActive={isActive}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={1} gap={1}>
      <WizardHeader
        {...headerProps}
        showDescription={showDescription}
        showAliases={showAliases}
        showConfig={showConfig}
        showSteps={showSteps}
      />
      {renderPhaseContent()}
    </Box>
  );
};
