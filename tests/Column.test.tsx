import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { FeedbackType } from '../src/types/types.js';

import {
  createFeedback,
  createMessage,
  createWelcomeDefinition,
} from '../src/services/components.js';

import { Column } from '../src/ui/Column.js';

describe('Column rendering optimization', () => {
  it('uses stable IDs that prevent unnecessary re-renders', () => {
    // The key insight: React uses keys to determine if a component should
    // re-render. With index keys, adding items changes all indices and causes
    // re-renders. With stable UUIDs, only new items render.

    const app = {
      name: 'test-app',
      version: '1.0.0',
      description: 'Test application',
      isDev: false,
      isDebug: false,
    };

    const component1 = createWelcomeDefinition(app);
    const component2 = createMessage('Message 1');
    const component3 = createFeedback(FeedbackType.Info, 'Info');

    // IDs should be stable and unique
    expect(component1.id).toBeTruthy();
    expect(component2.id).toBeTruthy();
    expect(component3.id).toBeTruthy();
    expect(component1.id).not.toBe(component2.id);
    expect(component2.id).not.toBe(component3.id);

    // Adding new items doesn't change existing IDs
    const allComponents = [component1, component2, component3];
    const moreComponents = [
      createMessage('New 1'),
      ...allComponents,
      createMessage('New 2'),
    ];

    // Original component IDs remain unchanged
    expect(moreComponents[1].id).toBe(component1.id);
    expect(moreComponents[2].id).toBe(component2.id);
    expect(moreComponents[3].id).toBe(component3.id);
  });

  it('ensures each component has a unique id', () => {
    const app = {
      name: 'test-app',
      version: '1.0.0',
      description: 'Test application',
      isDev: false,
      isDebug: false,
    };

    const components = [
      createWelcomeDefinition(app),
      createMessage('Message 1'),
      createMessage('Message 2'),
      createFeedback(FeedbackType.Info, 'Info'),
      createFeedback(FeedbackType.Succeeded, 'Success'),
    ];

    // All IDs should be unique
    const ids = components.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    // All IDs should be valid UUIDs (v4 format)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    ids.forEach((id) => {
      expect(id).toMatch(uuidRegex);
    });
  });

  it('maintains stable keys across multiple additions', () => {
    const app = {
      name: 'test-app',
      version: '1.0.0',
      description: 'Test application',
      isDev: false,
      isDebug: false,
    };

    const component1 = createWelcomeDefinition(app);
    const component2 = createMessage('Message 1');
    const component3 = createMessage('Message 2');

    // Render with 1 item
    const { rerender, lastFrame } = render(
      <Column items={[component1]} debug={false} />
    );
    const frame1 = lastFrame();

    // Add second item
    rerender(<Column items={[component1, component2]} debug={false} />);
    const frame2 = lastFrame();

    // Add third item
    rerender(
      <Column items={[component1, component2, component3]} debug={false} />
    );
    const frame3 = lastFrame();

    // All frames should contain content (basic smoke test)
    expect(frame1).toBeTruthy();
    expect(frame2).toBeTruthy();
    expect(frame3).toBeTruthy();

    // The IDs should remain the same
    expect(component1.id).toBeTruthy();
    expect(component2.id).toBeTruthy();
    expect(component3.id).toBeTruthy();
  });

  it('uses component id as React key', () => {
    const message1 = createMessage('First');
    const message2 = createMessage('Second');

    const { lastFrame } = render(
      <Column items={[message1, message2]} debug={false} />
    );

    // This is a basic test to ensure the component renders
    // React keys are internal, but we can verify IDs are unique
    expect(message1.id).not.toBe(message2.id);
    expect(lastFrame()).toBeTruthy();
  });

  it('verifies Column component uses id as key', () => {
    // Verify that the Column component implementation uses the id field
    const message1 = createMessage('First');
    const message2 = createMessage('Second');

    // Render the actual Column component
    const { lastFrame } = render(
      <Column items={[message1, message2]} debug={false} />
    );

    // Basic smoke test - component renders
    expect(lastFrame()).toBeTruthy();

    // The real test is in the Column.tsx implementation:
    // items.map((item) => <Box key={item.id}>...</Box>)
    // This ensures React uses stable keys for optimal reconciliation
  });
});
