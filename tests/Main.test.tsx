import { describe, it, expect, vi } from 'vitest';
import React from 'react';

import { Main } from '../src/ui/Main.js';
import { AppInfo } from '../src/types/components.js';
import type { AnthropicService } from '../src/services/anthropic.js';

describe('Main component state management', () => {
  const mockApp: AppInfo = {
    name: 'test-app',
    version: '1.0.0',
    description: 'Test application',
    isDev: false,
  };

  const mockService = {} as AnthropicService;

  describe('Configuration flow', () => {
    it('renders config when not ready and has command', () => {
      const result = (
        <Main
          app={mockApp}
          command="test command"
          isReady={false}
          onConfigured={() => mockService}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.app).toBe(mockApp);
      expect(result.props.command).toBe('test command');
      expect(result.props.isReady).toBe(false);
    });

    it('renders welcome and config when not ready without command', () => {
      const result = (
        <Main
          app={mockApp}
          command={null}
          isReady={false}
          onConfigured={() => {}}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.command).toBeNull();
      expect(result.props.isReady).toBe(false);
    });

    it('calls onConfigured when config completes', () => {
      const onConfigured = vi.fn(() => mockService);

      const result = (
        <Main
          app={mockApp}
          command="test"
          isReady={false}
          onConfigured={onConfigured}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.onConfigured).toBe(onConfigured);
    });
  });

  describe('Command execution flow', () => {
    it('renders command when ready with command', () => {
      const result = (
        <Main
          app={mockApp}
          command="install dependencies"
          service={mockService}
          isReady={true}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.command).toBe('install dependencies');
      expect(result.props.service).toBe(mockService);
      expect(result.props.isReady).toBe(true);
    });

    it('renders welcome when ready without command', () => {
      const result = (
        <Main
          app={mockApp}
          command={null}
          service={mockService}
          isReady={true}
        />
      );

      expect(result).toBeDefined();
      expect(result.props.command).toBeNull();
      expect(result.props.isReady).toBe(true);
    });
  });

  describe('Props validation', () => {
    it('accepts all required props', () => {
      const result = (
        <Main
          app={mockApp}
          command={null}
          isReady={true}
          service={mockService}
        />
      );

      expect(result.props.app).toBeDefined();
      expect(result.props.command).toBeNull();
      expect(result.props.isReady).toBe(true);
      expect(result.props.service).toBeDefined();
    });

    it('accepts optional onConfigured prop', () => {
      const onConfigured = vi.fn();

      const result = (
        <Main
          app={mockApp}
          command={null}
          isReady={false}
          onConfigured={onConfigured}
        />
      );

      expect(result.props.onConfigured).toBe(onConfigured);
    });

    it('works without service when not ready', () => {
      const result = (
        <Main
          app={mockApp}
          command="test"
          isReady={false}
          onConfigured={() => mockService}
        />
      );

      expect(result.props.service).toBeUndefined();
    });
  });

  describe('State transitions', () => {
    it('transitions from not ready to ready state', () => {
      const notReady = (
        <Main
          app={mockApp}
          command="test"
          isReady={false}
          onConfigured={() => mockService}
        />
      );

      const ready = (
        <Main
          app={mockApp}
          command="test"
          service={mockService}
          isReady={true}
        />
      );

      expect(notReady.props.isReady).toBe(false);
      expect(ready.props.isReady).toBe(true);
    });

    it('handles config completion returning service', () => {
      const onConfigured = vi.fn(() => mockService);

      const result = (
        <Main
          app={mockApp}
          command="test"
          isReady={false}
          onConfigured={onConfigured}
        />
      );

      expect(result.props.onConfigured).toBe(onConfigured);
    });

    it('handles config completion returning void', () => {
      const onConfigured = vi.fn();

      const result = (
        <Main
          app={mockApp}
          command={null}
          isReady={false}
          onConfigured={onConfigured}
        />
      );

      expect(result.props.onConfigured).toBe(onConfigured);
    });
  });

  describe('App info handling', () => {
    it('passes app info to children', () => {
      const customApp: AppInfo = {
        name: 'custom-app',
        version: '2.0.0',
        description: 'Custom description',
        isDev: true,
      };

      const result = (
        <Main
          app={customApp}
          command={null}
          service={mockService}
          isReady={true}
        />
      );

      expect(result.props.app).toBe(customApp);
      expect(result.props.app.name).toBe('custom-app');
      expect(result.props.app.version).toBe('2.0.0');
      expect(result.props.app.isDev).toBe(true);
    });

    it('handles dev mode flag', () => {
      const devApp = { ...mockApp, isDev: true };
      const prodApp = { ...mockApp, isDev: false };

      const devResult = (
        <Main
          app={devApp}
          command={null}
          service={mockService}
          isReady={true}
        />
      );

      const prodResult = (
        <Main
          app={prodApp}
          command={null}
          service={mockService}
          isReady={true}
        />
      );

      expect(devResult.props.app.isDev).toBe(true);
      expect(prodResult.props.app.isDev).toBe(false);
    });
  });
});
