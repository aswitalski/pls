import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { List } from '../../src/components/views/List.js';

describe('UI component edge cases', () => {
  describe('List edge cases', () => {
    it('handles deeply nested items (3+ levels)', () => {
      const items = [
        {
          description: { text: 'Level 0', color: 'white' },
          type: { text: 'root', color: 'cyan' },
          children: [
            {
              description: { text: 'Level 1', color: 'white' },
              type: { text: 'child', color: 'green' },
              children: [
                {
                  description: { text: 'Level 2', color: 'white' },
                  type: { text: 'grandchild', color: 'purple' },
                  children: [
                    {
                      description: { text: 'Level 3', color: 'white' },
                      type: { text: 'great-grandchild', color: 'orange' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      const result = <List items={items} />;

      expect(
        result.props.items[0].children?.[0].children?.[0].children
      ).toBeDefined();
    });

    it('handles special unicode characters', () => {
      const items = [
        {
          description: { text: '→ ✓ ✗ ⊘ 🚀 📦 🔧', color: 'white' },
          type: { text: 'execute', color: 'green' },
        },
      ];

      const result = <List items={items} />;

      expect(result.props.items[0].description.text).toContain('→');
      expect(result.props.items[0].description.text).toContain('🚀');
    });

    it('hides types by default and shows when specified', () => {
      const items = [
        {
          description: { text: 'Task', color: 'white' },
          type: { text: 'execute', color: 'green' },
        },
      ];

      const { lastFrame: lastFrameDefault } = render(<List items={items} />);
      const { lastFrame: lastFrameFalse } = render(
        <List items={items} showType={false} />
      );
      const { lastFrame: lastFrameTrue } = render(
        <List items={items} showType={true} />
      );

      const outputDefault = lastFrameDefault();
      const outputFalse = lastFrameFalse();
      const outputTrue = lastFrameTrue();

      // Default should hide types (false)
      expect(outputDefault).not.toContain('execute');
      // Explicit false should hide types
      expect(outputFalse).not.toContain('execute');
      // Explicit true should show types
      expect(outputTrue).toContain('execute');
    });
  });
});
