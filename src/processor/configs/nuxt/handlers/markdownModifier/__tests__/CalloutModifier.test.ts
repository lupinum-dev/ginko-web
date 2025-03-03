import { describe, it, expect } from 'vitest';
import { CalloutModifier } from '../CalloutModifier';
import type { GinkoASTNode } from '../types';

describe('CalloutModifier', () => {
  const modifier = new CalloutModifier();

  describe('canHandle', () => {
    it('should handle valid callout types', () => {
      const validTypes = ['note', 'info', 'danger', 'warning', 'quote', 'question', 'tip'];
      for (const type of validTypes) {
        expect(modifier.canHandle({ type: 'block', name: type })).toBe(true);
        expect(modifier.canHandle({ type: 'block', name: `${type}-` })).toBe(true);
      }
    });

    it('should not handle invalid types', () => {
      expect(modifier.canHandle({ type: 'block', name: 'invalid' })).toBe(false);
      expect(modifier.canHandle({ type: 'text', content: 'text' })).toBe(false);
    });
  });

  describe('modifyBlock', () => {
    it('should transform basic callout', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: [{ type: 'text', content: 'Inside' }]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [{ name: 'type', value: 'note' }],
        content: [{ type: 'text', content: 'Inside' }]
      });
    });

    it('should transform collapsed callout', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note-',
        content: [{ type: 'text', content: 'Inside' }]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' },
          { name: 'collapsed', value: true }
        ],
        content: [{ type: 'text', content: 'Inside' }]
      });
    });

    it('should handle title from properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note',
        properties: [{ name: 'title', value: 'Title' }],
        content: [{ type: 'text', content: 'Inside' }]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' },
          { name: 'title', value: 'Title' }
        ],
        content: [{ type: 'text', content: 'Inside' }]
      });
    });

    it('should handle title from --title element', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: [
          { type: 'dash-element', name: 'title', label: 'Here is the title' },
          { type: 'text', content: 'Inside' }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' },
          { name: 'title', value: 'Here is the title' }
        ],
        content: [{ type: 'text', content: 'Inside' }]
      });
    });

    it('should preserve other properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'warning',
        properties: [{ name: 'single prop', value: 'here' }],
        content: [{ type: 'text', content: 'Inside' }]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'warning' },
          { name: 'single prop', value: 'here' }
        ],
        content: [{ type: 'text', content: 'Inside' }]
      });
    });

    it('should handle all callout types', () => {
      const types = ['note', 'info', 'danger', 'warning', 'quote', 'question', 'tip'];
      for (const type of types) {
        const input: GinkoASTNode = {
          type: 'block',
          name: type,
          content: [{ type: 'text', content: 'Inside' }]
        };

        const result = modifier.modifyBlock(input);
        expect(result).toEqual({
          type: 'block',
          name: 'ginko-callout',
          properties: [{ name: 'type', value: type }],
          content: [{ type: 'text', content: 'Inside' }]
        });
      }
    });

    it('should prefer --title over property title', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note',
        properties: [{ name: 'title', value: 'Property Title' }],
        content: [
          { type: 'dash-element', name: 'title', label: 'Element Title' },
          { type: 'text', content: 'Inside' }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' },
          { name: 'title', value: 'Element Title' }
        ],
        content: [{ type: 'text', content: 'Inside' }]
      });
    });

    it('should handle title element with content', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: [
          {
            type: 'dash-element',
            name: 'title',
            label: 'Two ways to write',
            content: [
              {
                type: 'text',
                content: 'We offer two ways two write your callouts, with Ginko Callouts as our recommended option.\n'
              }
            ]
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' },
          { name: 'title', value: 'Two ways to write' }
        ],
        content: [
          {
            type: 'text',
            content: 'We offer two ways two write your callouts, with Ginko Callouts as our recommended option.\n'
          }
        ]
      });
    });

    it('should preserve code blocks, inline code, and dividers', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: [
          {
            type: 'text',
            content: 'Some text with '
          },
          {
            type: 'inline-code',
            content: 'inline code'
          },
          {
            type: 'text',
            content: ' and a code block:\n\n'
          },
          {
            type: 'code-block',
            language: 'javascript',
            content: 'console.log("Hello");\n'
          },
          {
            type: 'divider'
          },
          {
            type: 'text',
            content: 'More text after divider\n'
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' }
        ],
        content: [
          {
            type: 'text',
            content: 'Some text with '
          },
          {
            type: 'inline-code',
            content: 'inline code'
          },
          {
            type: 'text',
            content: ' and a code block:\n\n'
          },
          {
            type: 'code-block',
            language: 'javascript',
            content: 'console.log("Hello");\n'
          },
          {
            type: 'divider'
          },
          {
            type: 'text',
            content: 'More text after divider\n'
          }
        ]
      });
    });
  });
}); 