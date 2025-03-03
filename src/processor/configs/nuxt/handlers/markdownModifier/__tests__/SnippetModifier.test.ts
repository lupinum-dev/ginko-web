import { describe, it, expect } from 'vitest';
import type { GinkoASTNode } from '../types';
import { SnippetModifier } from '../SnippetModifier';

describe('SnippetModifier', () => {
  const modifier = new SnippetModifier();

  describe('canHandle', () => {
    it('should return true for snippet blocks', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'snippet',
        properties: [{ name: 'id', value: 'test123' }],
        content: []
      };
      expect(modifier.canHandle(node)).toBe(true);
    });

    it('should return true for inline snippet blocks', () => {
      const node: GinkoASTNode = {
        type: 'inline-block',
        name: 'snippet',
        properties: [{ name: 'id', value: 'test123' }]
      };
      expect(modifier.canHandle(node)).toBe(true);
    });

    it('should return false for non-snippet blocks', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: []
      };
      expect(modifier.canHandle(node)).toBe(false);
    });

    it('should return false for non-block nodes', () => {
      const node: GinkoASTNode = {
        type: 'text',
        content: 'Some text'
      };
      expect(modifier.canHandle(node)).toBe(false);
    });
  });

  describe('modifyBlock', () => {
    it('should transform snippet blocks to ginko-snippet-source blocks', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'snippet',
        properties: [{ name: 'id', value: 'b6a5a8b0' }],
        content: [{ type: 'text', content: 'This will be shown in the snippet' }]
      };

      const result = modifier.modifyBlock(node);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-snippet-source',
        properties: [{ name: 'id', value: 'b6a5a8b0' }],
        content: [{ type: 'text', content: 'This will be shown in the snippet' }]
      });
    });

    it('should transform inline snippet blocks to ginko-snippet inline blocks', () => {
      const node: GinkoASTNode = {
        type: 'inline-block',
        name: 'snippet',
        properties: [{ name: 'id', value: 'x6532c60' }]
      };

      const result = modifier.modifyBlock(node);
      expect(result).toEqual({
        type: 'inline-block',
        name: 'ginko-snippet',
        properties: [{ name: 'id', value: 'x6532c60' }]
      });
    });

    it('should handle snippet blocks with no properties', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'snippet',
        content: [{ type: 'text', content: 'Content' }]
      };

      const result = modifier.modifyBlock(node);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-snippet-source',
        properties: [],
        content: [{ type: 'text', content: 'Content' }]
      });
    });

    it('should handle inline snippet blocks with no properties', () => {
      const node: GinkoASTNode = {
        type: 'inline-block',
        name: 'snippet'
      };

      const result = modifier.modifyBlock(node);
      expect(result).toEqual({
        type: 'inline-block',
        name: 'ginko-snippet',
        properties: []
      });
    });

    it('should not modify non-snippet nodes', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: [{ type: 'text', content: 'Content' }]
      };

      const result = modifier.modifyBlock(node);
      expect(result).toBe(node);
    });
  });

  describe('integration', () => {
    it('should handle the example from the user query', () => {
      // Create a simplified version of the AST from the user query
      const ast: GinkoASTNode = {
        type: 'document',
        content: [
          {
            type: 'text',
            content: '# Snippet\n\nVor den Quizzes, '
          },
          {
            type: 'inline-block',
            name: 'snippet',
            properties: [{ name: 'id', value: 'b6a5a8b0' }]
          },
          {
            type: 'text',
            content: ' entspanne dich mit einem **TIC-TAC-TOE** Turnier gegen den Computer. Das Turnier gilt als gewonnen, wenn einer der beiden Spieler 10 Siege  '
          },
          {
            type: 'inline-block',
            name: 'snippet',
            properties: [{ name: 'id', value: 'x6532c60' }]
          },
          {
            type: 'text',
            content: '\n\n'
          },
          {
            type: 'block',
            name: 'snippet',
            properties: [{ name: 'id', value: 'b6a5a8b0' }],
            content: [{ type: 'text', content: 'This will be shown in the snippet  \n' }]
          },
          {
            type: 'block',
            name: 'snippet',
            properties: [{ name: 'id', value: 'x6532c60' }],
            content: [{ type: 'text', content: 'This will be shown in the other snippet  \n$a=0$ und $H=1$  \n' }]
          }
        ]
      };

      // Process each node that the modifier can handle
      const processedContent = ast.content.map(node => {
        if (modifier.canHandle(node)) {
          return modifier.modifyBlock(node);
        }
        return node;
      });

      // Check inline snippets
      const inlineSnippets = processedContent.filter(
        node => node.type === 'inline-block' && node.name === 'ginko-snippet'
      );
      expect(inlineSnippets).toHaveLength(2);
      expect(inlineSnippets[0].properties?.[0].value).toBe('b6a5a8b0');
      expect(inlineSnippets[1].properties?.[0].value).toBe('x6532c60');

      // Check block snippets
      const blockSnippets = processedContent.filter(
        node => node.type === 'block' && node.name === 'ginko-snippet-source'
      );
      expect(blockSnippets).toHaveLength(2);
      expect(blockSnippets[0].properties?.[0].value).toBe('b6a5a8b0');
      expect(blockSnippets[1].properties?.[0].value).toBe('x6532c60');
    });
  });
});