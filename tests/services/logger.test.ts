import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComponentName } from '../../src/types/types.js';
import {
  ComponentDefinition,
  DebugDefinitionProps,
} from '../../src/types/components.js';

import { DebugLevel } from '../../src/services/configuration.js';
import {
  getDebugLevel,
  initializeLogger,
  logPrompt,
  logResponse,
  setDebugLevel,
} from '../../src/services/logger.js';
import { Palette } from '../../src/services/colors.js';

describe('Logger service', () => {
  // Helper to extract debug props from component definition
  function getDebugProps(
    component: ComponentDefinition | null
  ): DebugDefinitionProps {
    if (!component) {
      throw new Error('Component is null');
    }
    return component.props as DebugDefinitionProps;
  }

  beforeEach(() => {
    // Reset to default level before each test
    setDebugLevel(DebugLevel.None);
  });

  afterEach(() => {
    // Clean up after each test
    setDebugLevel(DebugLevel.None);
  });

  describe('Debug level management', () => {
    it('defaults to None level', () => {
      expect(getDebugLevel()).toBe(DebugLevel.None);
    });

    it('sets and gets debug level', () => {
      setDebugLevel(DebugLevel.Info);
      expect(getDebugLevel()).toBe(DebugLevel.Info);

      setDebugLevel(DebugLevel.Verbose);
      expect(getDebugLevel()).toBe(DebugLevel.Verbose);

      setDebugLevel(DebugLevel.None);
      expect(getDebugLevel()).toBe(DebugLevel.None);
    });

    it('initializes from config', () => {
      // Note: This loads from actual user config, so we just verify it doesn't crash
      // and returns a valid debug level
      initializeLogger();
      const level = getDebugLevel();
      expect([DebugLevel.None, DebugLevel.Info, DebugLevel.Verbose]).toContain(
        level
      );
    });
  });

  describe('Logging prompts', () => {
    it('returns null when debug level is None', () => {
      setDebugLevel(DebugLevel.None);
      const result = logPrompt('plan', 'test command', 'test instructions');
      expect(result).toBeNull();
    });

    it('returns null when debug level is Info', () => {
      setDebugLevel(DebugLevel.Info);
      const result = logPrompt('plan', 'test command', 'test instructions');
      expect(result).toBeNull();
    });

    it('creates debug component when debug level is Verbose', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result = logPrompt('plan', 'test command', 'test instructions');

      expect(result).not.toBeNull();
      expect(result?.name).toBe(ComponentName.Debug);

      const props = getDebugProps(result);
      expect(props.title).toMatch(/^SYSTEM PROMPT \(\d+ lines, \d+ bytes\)$/);
      expect(props.color).toBe(Palette.Gray);
      expect(props.content).toContain('Tool: plan');
      expect(props.content).toContain('Command: test command');
      expect(props.content).toContain('test instructions');
    });

    it('includes full instructions without truncation', () => {
      setDebugLevel(DebugLevel.Verbose);
      const longInstructions = 'A'.repeat(99);
      const result = logPrompt('plan', 'command', longInstructions);

      const props = getDebugProps(result);
      // Content should have: "Tool: plan\nCommand: command\n\n" + full instructions
      const actualInstructions = props.content.substring(
        'Tool: plan\nCommand: command\n\n'.length
      );
      expect(actualInstructions.length).toBe(100);
    });

    it('handles special characters in tool name and command', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result = logPrompt(
        'plan-tool',
        'test: "command" with quotes',
        'instructions'
      );

      const props = getDebugProps(result);
      expect(props.content).toContain('Tool: plan-tool');
      expect(props.content).toContain('Command: test: "command" with quotes');
    });

    it('creates unique component IDs for each call', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result1 = logPrompt('plan', 'cmd1', 'instr1');
      const result2 = logPrompt('plan', 'cmd2', 'instr2');

      expect(result1?.id).toBeDefined();
      expect(result2?.id).toBeDefined();
      expect(result1?.id).not.toBe(result2?.id);
    });
  });

  describe('Logging responses', () => {
    it('returns null when debug level is None', () => {
      setDebugLevel(DebugLevel.None);
      const result = logResponse('plan', { message: 'test' }, 100);
      expect(result).toBeNull();
    });

    it('returns null when debug level is Info', () => {
      setDebugLevel(DebugLevel.Info);
      const result = logResponse('plan', { message: 'test' }, 100);
      expect(result).toBeNull();
    });

    it('creates debug component when debug level is Verbose', () => {
      setDebugLevel(DebugLevel.Verbose);
      const response = { message: 'test message', tasks: [] };
      const result = logResponse('plan', response, 250);

      expect(result).not.toBeNull();
      expect(result?.name).toBe(ComponentName.Debug);

      const props = getDebugProps(result);
      expect(props.title).toMatch(/^LLM RESPONSE \(\d+ ms\)$/);
      expect(props.color).toBe(Palette.AshGray);
      expect(props.content).toContain('Tool: plan');
      expect(props.content).toContain('"message": "test message"');
    });

    it('includes full response without truncation', () => {
      setDebugLevel(DebugLevel.Verbose);
      const longResponse = {
        message: 'A'.repeat(500),
        tasks: [{ action: 'B'.repeat(500) }],
      };
      const result = logResponse('plan', longResponse, 300);

      const props = getDebugProps(result);
      // Response should include full JSON stringified content
      const jsonString = JSON.stringify(longResponse, null, 2);
      expect(props.content).toContain(jsonString);
    });

    it('handles complex nested response objects', () => {
      setDebugLevel(DebugLevel.Verbose);
      const response = {
        message: 'test',
        tasks: [
          {
            action: 'do something',
            type: 'execute',
            params: { nested: { data: 'value' } },
          },
        ],
      };
      const result = logResponse('execute', response, 150);

      const props = getDebugProps(result);
      expect(props.content).toContain('"action": "do something"');
      expect(props.content).toContain('"type": "execute"');
    });

    it('handles null response', () => {
      setDebugLevel(DebugLevel.Verbose);

      const nullResult = logResponse('plan', null, 50);
      const props = getDebugProps(nullResult);
      expect(props.content).toContain('null');
    });

    it('creates unique component IDs for each call', () => {
      setDebugLevel(DebugLevel.Verbose);
      const result1 = logResponse('plan', { msg: '1' }, 100);
      const result2 = logResponse('plan', { msg: '2' }, 200);

      expect(result1?.id).toBeDefined();
      expect(result2?.id).toBeDefined();
      expect(result1?.id).not.toBe(result2?.id);
    });
  });

  describe('Real-life scenarios', () => {
    it('logs complete request-response cycle at Verbose level', () => {
      setDebugLevel(DebugLevel.Verbose);

      const prompt = logPrompt(
        'plan',
        'create a new file',
        'You are the planning component...'
      );
      const response = logResponse(
        'plan',
        {
          message: 'Creating the file.',
          tasks: [{ action: 'Create file test.txt', type: 'execute' }],
        },
        180
      );

      expect(prompt).not.toBeNull();
      expect(response).not.toBeNull();
      expect(prompt?.name).toBe(ComponentName.Debug);
      expect(response?.name).toBe(ComponentName.Debug);
    });

    it('suppresses all logging when level is None', () => {
      setDebugLevel(DebugLevel.None);

      const prompt = logPrompt('plan', 'cmd', 'instr');
      const response = logResponse('plan', { msg: 'test' }, 120);

      expect(prompt).toBeNull();
      expect(response).toBeNull();
    });

    it('changes debug level mid-operation', () => {
      setDebugLevel(DebugLevel.None);
      expect(logPrompt('plan', 'cmd1', 'instr1')).toBeNull();

      setDebugLevel(DebugLevel.Verbose);
      expect(logPrompt('plan', 'cmd2', 'instr2')).not.toBeNull();

      setDebugLevel(DebugLevel.Info);
      expect(logPrompt('plan', 'cmd3', 'instr3')).toBeNull();
    });

    it('logs different tool types with appropriate content', () => {
      setDebugLevel(DebugLevel.Verbose);

      const planPrompt = logPrompt('plan', 'list files', 'Plan instructions');
      const executePrompt = logPrompt(
        'execute',
        'run command',
        'Execute instructions'
      );
      const answerPrompt = logPrompt(
        'answer',
        'what is typescript',
        'Answer instructions'
      );

      const planProps = getDebugProps(planPrompt);
      const executeProps = getDebugProps(executePrompt);
      const answerProps = getDebugProps(answerPrompt);

      expect(planProps.content).toContain('Tool: plan');
      expect(executeProps.content).toContain('Tool: execute');
      expect(answerProps.content).toContain('Tool: answer');
    });

    it('handles API error responses', () => {
      setDebugLevel(DebugLevel.Verbose);

      const errorResponse = {
        error: {
          type: 'api_error',
          message: 'Rate limit exceeded',
        },
      };

      const result = logResponse('plan', errorResponse, 400);
      const props = getDebugProps(result);
      expect(props.content).toContain('"error"');
      expect(props.content).toContain('Rate limit exceeded');
    });

    it('logs multiline instructions correctly', () => {
      setDebugLevel(DebugLevel.Verbose);

      const multilineInstructions = `Line 1
Line 2
Line 3
Line 4`;

      const result = logPrompt('plan', 'command', multilineInstructions);
      const props = getDebugProps(result);
      expect(props.content).toContain('Line 1');
      expect(props.content).toContain('Line 2');
    });
  });
});
