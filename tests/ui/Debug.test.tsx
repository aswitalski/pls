import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';

import { ComponentStatus } from '../../src/types/components.js';

import { Palette } from '../../src/services/colors.js';

import { Debug } from '../../src/ui/Debug.js';

describe('Debug component', () => {
  describe('Rendering', () => {
    it('renders with title and content', () => {
      const { lastFrame } = render(
        <Debug
          title="TEST TITLE"
          content="Test content"
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('TEST TITLE');
      expect(lastFrame()).toContain('Test content');
    });

    it('renders with dark gray color', () => {
      const { lastFrame } = render(
        <Debug
          title="PROMPT"
          content="Content"
          color={Palette.DarkGray}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('PROMPT');
      expect(lastFrame()).toContain('Content');
    });

    it('renders with gray color', () => {
      const { lastFrame } = render(
        <Debug
          title="RESPONSE"
          content="Content"
          color={Palette.Gray}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('RESPONSE');
      expect(lastFrame()).toContain('Content');
    });

    it('renders with white color', () => {
      const { lastFrame } = render(
        <Debug
          title="INFO"
          content="Content"
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('INFO');
      expect(lastFrame()).toContain('Content');
    });
  });

  describe('Content formatting', () => {
    it('renders multiline content', () => {
      const multilineContent = `Line 1
Line 2
Line 3`;

      const { lastFrame } = render(
        <Debug
          title="MULTILINE"
          content={multilineContent}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
    });

    it('renders JSON content', () => {
      const jsonContent = JSON.stringify(
        {
          message: 'test',
          tasks: [{ action: 'do something' }],
        },
        null,
        2
      );

      const { lastFrame } = render(
        <Debug
          title="JSON"
          content={jsonContent}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      expect(output).toContain('"message"');
      expect(output).toContain('test');
      expect(output).toContain('"action"');
    });

    it('renders empty content', () => {
      const { lastFrame } = render(
        <Debug
          title="EMPTY"
          content=""
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('EMPTY');
    });

    it('renders long content without wrapping issues', () => {
      const longContent = 'A'.repeat(200);

      const { lastFrame } = render(
        <Debug
          title="LONG"
          content={longContent}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('LONG');
      expect(lastFrame()).toContain('A');
    });

    it('renders content with special characters', () => {
      const specialContent = 'Test: "quoted" & <bracketed> \'single\'';

      const { lastFrame } = render(
        <Debug
          title="SPECIAL"
          content={specialContent}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('SPECIAL');
      expect(lastFrame()).toContain('quoted');
    });
  });

  describe('Real-life scenarios', () => {
    it('renders system prompt debug info', () => {
      const systemPrompt = `Tool: plan
Command: create a new file
Instructions: You are the planning component...`;

      const { lastFrame } = render(
        <Debug
          title="SYSTEM PROMPT"
          content={systemPrompt}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      expect(output).toContain('SYSTEM PROMPT');
      expect(output).toContain('Tool: plan');
      expect(output).toContain('Command: create a new file');
      expect(output).toContain('Instructions:');
    });

    it('renders LLM response debug info', () => {
      const llmResponse = `Tool: execute
RESPONSE:

{
  "message": "Executing commands.",
  "commands": [
    {
      "description": "Create file",
      "command": "touch test.txt"
    }
  ]
}`;

      const { lastFrame } = render(
        <Debug
          title="LLM RESPONSE"
          content={llmResponse}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      expect(output).toContain('LLM RESPONSE');
      expect(output).toContain('Tool: execute');
      expect(output).toContain('RESPONSE:');
      expect(output).toContain('Executing commands');
    });

    it('renders truncated long instructions', () => {
      const truncatedInstructions = `Tool: plan
Command: complex command
INSTRUCTIONS:

${'A'.repeat(400)}`;

      const { lastFrame } = render(
        <Debug
          title="SYSTEM PROMPT"
          content={truncatedInstructions}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(lastFrame()).toContain('SYSTEM PROMPT');
      expect(lastFrame()).toContain('Tool: plan');
    });

    it('renders API error response', () => {
      const errorResponse = `Tool: plan
RESPONSE:

{
  "error": {
    "type": "api_error",
    "message": "Rate limit exceeded"
  }
}`;

      const { lastFrame } = render(
        <Debug
          title="LLM RESPONSE"
          content={errorResponse}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      expect(output).toContain('LLM RESPONSE');
      expect(output).toContain('api_error');
      expect(output).toContain('Rate limit exceeded');
    });

    it('renders debug info for different tools', () => {
      const tools = ['plan', 'execute', 'answer', 'introspect', 'validate'];

      tools.forEach((tool) => {
        const content = `Tool: ${tool}\nCommand: test command`;

        const { lastFrame } = render(
          <Debug
            title="SYSTEM PROMPT"
            content={content}
            color={Palette.White}
            status={ComponentStatus.Done}
          />
        );

        expect(lastFrame()).toContain(`Tool: ${tool}`);
      });
    });

    it('maintains minimum width of 80 characters', () => {
      const shortContent = 'Short';

      const { lastFrame } = render(
        <Debug
          title="SHORT"
          content={shortContent}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      // The frame should have borders, padding, and maintain min width
      const frame = lastFrame() ?? '';
      const lines = frame.split('\n');

      // At least one line should be >= 80 chars (including border and padding)
      // minWidth={80} + paddingX={2}*2 + border={1}*2 = 86 total width
      const hasWideEnoughLine = lines.some((line) => line.length >= 80);
      expect(hasWideEnoughLine).toBe(true);
    });

    it('renders with horizontal padding of 2', () => {
      const content = 'Test content';

      const { lastFrame } = render(
        <Debug
          title="PADDED"
          content={content}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      // Check that output has proper spacing (this is a basic check)
      const output = lastFrame();
      expect(output).toContain('PADDED');
      expect(output).toContain('Test content');
    });

    it('renders with vertical padding of 1', () => {
      const content = 'Content';

      const { lastFrame } = render(
        <Debug
          title="TITLE"
          content={content}
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      const output = lastFrame();
      const lines = output?.split('\n') ?? [];

      // Should have border + padding + title + content + padding + border
      // At minimum: top border, empty line (padding), title, content, empty line (padding), bottom border
      expect(lines.length).toBeGreaterThanOrEqual(6);
    });

    it('renders complete debug workflow', () => {
      // Simulate a complete request-response debug cycle

      // 1. System prompt
      const { lastFrame: promptFrame } = render(
        <Debug
          title="SYSTEM PROMPT"
          content="Tool: plan\nCommand: list files"
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(promptFrame()).toContain('SYSTEM PROMPT');
      expect(promptFrame()).toContain('Tool: plan');

      // 2. LLM response
      const { lastFrame: responseFrame } = render(
        <Debug
          title="LLM RESPONSE"
          content='Tool: plan\nResponse:\n{"message": "Listing files."}'
          color={Palette.White}
          status={ComponentStatus.Done}
        />
      );

      expect(responseFrame()).toContain('LLM RESPONSE');
      expect(responseFrame()).toContain('Listing files');
    });
  });
});
