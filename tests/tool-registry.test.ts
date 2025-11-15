import { describe, expect, it } from 'vitest';

import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';

import { toolRegistry } from '../src/services/tool-registry.js';

describe('Tool registry', () => {
  const registry = toolRegistry;

  describe('Registering tools', () => {
    it('registers a new tool', () => {
      const mockTool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      registry.register('test', {
        schema: mockTool,
        instructionsPath: 'config/TEST.md',
      });

      expect(registry.hasTool('test')).toBe(true);
    });

    it('allows multiple tools to be registered', () => {
      const tool1: Tool = {
        name: 'tool1',
        description: 'Tool 1',
        input_schema: { type: 'object', properties: {}, required: [] },
      };

      const tool2: Tool = {
        name: 'tool2',
        description: 'Tool 2',
        input_schema: { type: 'object', properties: {}, required: [] },
      };

      registry.register('tool1', {
        schema: tool1,
        instructionsPath: 'config/TOOL1.md',
      });

      registry.register('tool2', {
        schema: tool2,
        instructionsPath: 'config/TOOL2.md',
      });

      expect(registry.hasTool('tool1')).toBe(true);
      expect(registry.hasTool('tool2')).toBe(true);
    });
  });

  describe('Getting tool configuration', () => {
    it('retrieves registered tool config', () => {
      const mockTool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: { type: 'object', properties: {}, required: [] },
      };

      const config = {
        schema: mockTool,
        instructionsPath: 'config/TEST.md',
      };

      registry.register('test', config);

      const retrieved = registry.getTool('test');
      expect(retrieved).toEqual(config);
    });

    it('returns undefined for unregistered tool', () => {
      const result = registry.getTool('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('Getting tool schema', () => {
    it('returns schema for registered tool', () => {
      const mockTool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: { type: 'object', properties: {}, required: [] },
      };

      registry.register('test', {
        schema: mockTool,
        instructionsPath: 'config/TEST.md',
      });

      const schema = registry.getSchema('test');
      expect(schema).toEqual(mockTool);
    });

    it('throws error for unregistered tool', () => {
      expect(() => registry.getSchema('nonexistent')).toThrow(
        "Tool 'nonexistent' not found in registry"
      );
    });
  });

  describe('Checking if tool exists', () => {
    it('returns true for registered tool', () => {
      const mockTool: Tool = {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: { type: 'object', properties: {}, required: [] },
      };

      registry.register('test', {
        schema: mockTool,
        instructionsPath: 'config/TEST.md',
      });

      expect(registry.hasTool('test')).toBe(true);
    });

    it('returns false for unregistered tool', () => {
      expect(registry.hasTool('nonexistent')).toBe(false);
    });
  });

  describe('Built-in tools', () => {
    it('has plan tool registered', () => {
      expect(registry.hasTool('plan')).toBe(true);

      const schema = registry.getSchema('plan');
      expect(schema.name).toBe('plan');
      expect(schema.description).toContain('Plan and structure tasks');
    });

    it('has introspect tool registered', () => {
      expect(registry.hasTool('introspect')).toBe(true);

      const schema = registry.getSchema('introspect');
      expect(schema.name).toBe('introspect');
      expect(schema.description).toContain('capabilities and skills');
    });

    it('can load plan instructions', () => {
      const instructions = registry.getInstructions('plan');
      expect(instructions).toBeTruthy();
      expect(instructions).toContain('Overview');
    });

    it('can load introspect instructions', () => {
      const instructions = registry.getInstructions('introspect');
      expect(instructions).toBeTruthy();
      expect(instructions).toContain('Overview');
      expect(instructions).toContain('introspect');
    });
  });
});
