import { Box } from 'ink';

import { ComponentStatus } from '../../types/components.js';

import { DebugLevel } from '../../configuration/types.js';

import { SettingView } from './Setting.js';

export interface ConfigState {
  values: Record<string, string>;
  completedStep: number;
  selectedIndex: number;
  steps?: ConfigStep[];
}

export enum StepType {
  Text = 'text',
  Selection = 'selection',
}

export interface ConfigOption {
  label: string;
  value: string;
}

export type ConfigStep = {
  description: string;
  key: string;
  path?: string;
  validate: (value: string) => boolean;
} & (
  | {
      type: StepType.Text;
      value: string | null;
    }
  | {
      type: StepType.Selection;
      options: ConfigOption[];
      defaultIndex: number;
    }
);

export interface ConfigViewProps {
  steps: ConfigStep[];
  state: ConfigState;
  status: ComponentStatus;
  debug?: DebugLevel;
}

/**
 * Config view: Multi-step configuration form for timeline display
 */
export const ConfigView = ({
  steps,
  state,
  status,
  debug = DebugLevel.None,
}: ConfigViewProps) => {
  const isActive = status === ComponentStatus.Active;
  const { values, completedStep, selectedIndex } = state;

  return (
    <Box flexDirection="column" marginLeft={1}>
      {steps.map((stepConfig, index) => {
        const isCurrentStep = index === completedStep && isActive;
        const isCompleted = index < completedStep;
        const wasAborted = index === completedStep && !isActive;
        const shouldShow = isCompleted || isCurrentStep || wasAborted;

        if (!shouldShow) {
          return null;
        }

        const configKey = stepConfig.path || stepConfig.key;

        return (
          <Box
            key={configKey}
            flexDirection="column"
            marginTop={index === 0 ? 0 : 1}
          >
            <SettingView
              step={stepConfig}
              value={values[configKey] || ''}
              selectedIndex={selectedIndex}
              isActive={isCurrentStep}
              debug={debug}
            />
          </Box>
        );
      })}
    </Box>
  );
};
