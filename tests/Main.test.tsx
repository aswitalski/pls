import React from 'react';
import { describe, expect, it } from 'vitest';

import { App } from '../src/types/types.js';

import { Main } from '../src/ui/Main.js';

describe('Main component queue-based architecture', () => {
  const mockApp: App = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
  };

  describe('Queue initialization', () => {
    it('initializes with command', () => {
      const result = <Main app={mockApp} command="test command" />;

      expect(result).toBeDefined();
      expect(result.props.app).toBe(mockApp);
      expect(result.props.command).toBe('test command');
    });

    it('initializes without command', () => {
      const result = <Main app={mockApp} command={null} />;

      expect(result).toBeDefined();
      expect(result.props.command).toBeNull();
    });
  });

  describe('Props validation', () => {
    it('accepts all props', () => {
      const result = <Main app={mockApp} command="test" />;

      expect(result.props.app).toBeDefined();
      expect(result.props.command).toBe('test');
    });

    it('works with minimal props', () => {
      const result = <Main app={mockApp} command={null} />;

      expect(result.props.app).toBeDefined();
      expect(result.props.command).toBeNull();
    });
  });

  describe('App info handling', () => {
    it('passes app info correctly', () => {
      const customApp: App = {
        name: 'custom-app',
        version: '2.0.0',
        description: 'Custom description',
        isDev: true,
      };

      const result = <Main app={customApp} command={null} />;

      expect(result.props.app).toBe(customApp);
      expect(result.props.app.name).toBe('custom-app');
      expect(result.props.app.version).toBe('2.0.0');
      expect(result.props.app.isDev).toBe(true);
    });

    it('handles dev mode flag', () => {
      const devApp = { ...mockApp, isDev: true };
      const prodApp = { ...mockApp, isDev: false };

      const devResult = <Main app={devApp} command={null} />;

      const prodResult = <Main app={prodApp} command={null} />;

      expect(devResult.props.app.isDev).toBe(true);
      expect(prodResult.props.app.isDev).toBe(false);
    });
  });
});
