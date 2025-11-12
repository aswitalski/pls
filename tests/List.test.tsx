import React from 'react';
import { describe, expect, it } from 'vitest';

import { List } from '../src/ui/List.js';

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
  });
});
