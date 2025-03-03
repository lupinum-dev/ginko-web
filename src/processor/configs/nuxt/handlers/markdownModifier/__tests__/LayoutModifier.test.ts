import { describe, it, expect } from 'vitest';
import { LayoutModifier } from '../LayoutModifier';
import { CalloutModifier } from '../CalloutModifier';
import type { GinkoASTNode } from '../types';

describe('LayoutModifier', () => {
  const modifier = new LayoutModifier();

  describe('canHandle', () => {
    it('should handle layout blocks', () => {
      expect(modifier.canHandle({ type: 'block', name: 'layout' } as GinkoASTNode)).toBe(true);
    });

    it('should not handle other blocks', () => {
      expect(modifier.canHandle({ type: 'block', name: 'note' } as GinkoASTNode)).toBe(false);
      expect(modifier.canHandle({ type: 'text', content: 'text' } as GinkoASTNode)).toBe(false);
    });
  });

  describe('modifyBlock', () => {
    it('should transform single column layout to ginko-center', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            content: [{ type: 'text', content: 'Center content' }]
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-center',
        properties: [],
        content: [{ type: 'text', content: 'Center content' }]
      });
    });

    it('should transform two-column layout to ginko-layout with ginko-columns', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            content: [{ type: 'text', content: 'First column' }]
          },
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            content: [{ type: 'text', content: 'Second column' }]
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'First column' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second column' }]
          }
        ]
      });
    });

    it('should preserve layout properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        properties: [{ name: 'type', value: 'border' }],
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            content: [{ type: 'text', content: 'First column' }]
          },
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            content: [{ type: 'text', content: 'Second column' }]
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [{ name: 'type', value: 'border' }],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'First column' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second column' }]
          }
        ]
      });
    });

    it('should preserve column properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [{ name: 'size', value: 'lg' }],
            content: [{ type: 'text', content: 'First column' }]
          },
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            content: [{ type: 'text', content: 'Second column' }]
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [{ name: 'size', value: 'lg' }],
            content: [{ type: 'text', content: 'First column' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second column' }]
          }
        ]
      });
    });

    it('should handle column labels', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'First column text',
            content: []
          },
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'Second column text',
            content: []
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'First column text' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second column text' }]
          }
        ]
      });
    });

    it('should handle the examples from the spec', () => {
      // Test case 1: Single column
      const input1: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'Center',
            content: []
          }
        ]
      };

      const result1 = modifier.modifyBlock(input1);
      expect(result1).toEqual({
        type: 'block',
        name: 'ginko-center',
        properties: [],
        content: [{ type: 'text', content: 'Center' }]
      });

      // Test case 2: Two columns
      const input2: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'First',
            content: []
          },
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'Second',
            content: []
          }
        ]
      };

      const result2 = modifier.modifyBlock(input2);
      expect(result2).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'First' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second' }]
          }
        ]
      });

      // Test case 3: Two columns with border type
      const input3: GinkoASTNode = {
        type: 'block',
        name: 'layout',
        properties: [{ name: 'type', value: 'border' }],
        content: [
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'First',
            content: []
          },
          {
            type: 'dash-element',
            name: 'col',
            properties: [],
            label: 'Second',
            content: []
          }
        ]
      };

      const result3 = modifier.modifyBlock(input3);
      expect(result3).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [{ name: 'type', value: 'border' }],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'First' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second' }]
          }
        ]
      });
    });

    it('should handle a complex document with layout blocks', () => {
      // Create an AST that mimics the full document structure
      const docAST: GinkoASTNode = {
        type: 'document',
        content: [
          {
            type: 'text',
            content: 'Above\n\n'
          },
          {
            type: 'block',
            name: 'layout',
            properties: [],
            content: [
              {
                type: 'dash-element',
                name: 'col',
                properties: [],
                content: [],
                label: 'First'
              },
              {
                type: 'dash-element',
                name: 'col',
                properties: [],
                content: [],
                label: 'Second'
              }
            ]
          },
          {
            type: 'divider'
          },
          {
            type: 'block',
            name: 'layout',
            properties: [],
            content: [
              {
                type: 'dash-element',
                name: 'col',
                properties: [],
                content: [],
                label: 'First'
              }
            ]
          },
          {
            type: 'text',
            content: 'Below'
          }
        ]
      };

      // Test the two layout blocks separately
      const layout1 = modifier.modifyBlock(docAST.content[1] as GinkoASTNode);
      const layout2 = modifier.modifyBlock(docAST.content[3] as GinkoASTNode);

      // Verify the first layout becomes a ginko-layout with two columns
      expect(layout1).toEqual({
        type: 'block',
        name: 'ginko-layout',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'First' }]
          },
          {
            type: 'block',
            name: 'ginko-column',
            properties: [],
            content: [{ type: 'text', content: 'Second' }]
          }
        ]
      });

      // Verify the second layout becomes a ginko-center
      expect(layout2).toEqual({
        type: 'block',
        name: 'ginko-center',
        properties: [],
        content: [{ type: 'text', content: 'First' }]
      });
    });

    it('should handle nested layouts within callouts', () => {
      // Create a complex AST with nested elements
      const nestedAST: GinkoASTNode = {
        type: 'block',
        name: 'note',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'layout',
            properties: [],
            content: [
              {
                type: 'dash-element',
                name: 'col',
                properties: [],
                content: [],
                label: 'First'
              },
              {
                type: 'dash-element',
                name: 'col',
                properties: [],
                content: [],
                label: 'Second'
              }
            ]
          }
        ]
      };

      // First modify the nested layout
      if (nestedAST.content && Array.isArray(nestedAST.content)) {
        const layoutNode = nestedAST.content[0] as GinkoASTNode;
        nestedAST.content[0] = modifier.modifyBlock(layoutNode);
      }

      // Then use a CalloutModifier to modify the outer note block
      const calloutModifier = new CalloutModifier();
      const modifiedCallout = calloutModifier.modifyBlock(nestedAST);

      // Verify the nested structure
      expect(modifiedCallout).toEqual({
        type: 'block',
        name: 'ginko-callout',
        properties: [
          { name: 'type', value: 'note' }
        ],
        content: [
          {
            type: 'block',
            name: 'ginko-layout',
            properties: [],
            content: [
              {
                type: 'block',
                name: 'ginko-column',
                properties: [],
                content: [{ type: 'text', content: 'First' }]
              },
              {
                type: 'block',
                name: 'ginko-column',
                properties: [],
                content: [{ type: 'text', content: 'Second' }]
              }
            ]
          }
        ]
      });
    });
  });
});