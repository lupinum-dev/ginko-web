import { describe, it, expect } from 'vitest';
import { StepsModifier } from '../StepsModifier';
import { MarkdownModifier } from '../MarkdownModifier';
import { parseMarkdown } from '../utils/ginkoParser';
import { astToMarkdown } from '../utils/astToMarkdown';
import type { GinkoASTNode, GinkoAST } from '../types';

describe('StepsModifier', () => {
  const modifier = new StepsModifier();

  describe('canHandle', () => {
    it('should handle steps blocks', () => {
      expect(modifier.canHandle({ type: 'block', name: 'steps' } as GinkoASTNode)).toBe(true);
    });

    it('should not handle other blocks', () => {
      expect(modifier.canHandle({ type: 'block', name: 'tabs' } as GinkoASTNode)).toBe(false);
      expect(modifier.canHandle({ type: 'text', content: 'text' } as GinkoASTNode)).toBe(false);
    });
  });

  describe('modifyBlock', () => {
    it('should transform steps block to ginko-steps', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'steps',
        properties: [],
        content: [
          {
            type: 'dash-element',
            name: 'step',
            properties: [],
            content: [{ type: 'text', content: 'Content of Step 1' }],
            label: 'Step 1'
          },
          {
            type: 'dash-element',
            name: 'step',
            properties: [],
            content: [{ type: 'text', content: 'Content of Step 2' }],
            label: 'Step 2'
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-steps',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-step',
            properties: [{ name: 'label', value: 'Step 1' }],
            content: [{ type: 'text', content: 'Content of Step 1' }]
          },
          {
            type: 'block',
            name: 'ginko-step',
            properties: [{ name: 'label', value: 'Step 2' }],
            content: [{ type: 'text', content: 'Content of Step 2' }]
          }
        ]
      });
    });

    it('should preserve steps properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'steps',
        properties: [{ name: 'level', value: 'h3' }],
        content: [
          {
            type: 'dash-element',
            name: 'step',
            properties: [],
            content: [{ type: 'text', content: 'Content of Step 1' }],
            label: 'Step 1'
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-steps',
        properties: [{ name: 'level', value: 'h3' }],
        content: [
          {
            type: 'block',
            name: 'ginko-step',
            properties: [{ name: 'label', value: 'Step 1' }],
            content: [{ type: 'text', content: 'Content of Step 1' }]
          }
        ]
      });
    });

    it('should handle steps with additional properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'steps',
        properties: [],
        content: [
          {
            type: 'dash-element',
            name: 'step',
            properties: [{ name: 'icon', value: 'check' }],
            content: [{ type: 'text', content: 'Content of Step 1' }],
            label: 'Step 1'
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-steps',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-step',
            properties: [
              { name: 'icon', value: 'check' },
              { name: 'label', value: 'Step 1' }
            ],
            content: [{ type: 'text', content: 'Content of Step 1' }]
          }
        ]
      });
    });
  });

  describe('integration', () => {
    it('should transform steps syntax to ginko-steps format', () => {
      // Create a markdown modifier with only the StepsModifier
      const markdownModifier = new MarkdownModifier([new StepsModifier()]);

      // Input markdown with steps syntax
      const input = `::steps{level="h3"}
--step Step 1
Content of Step 1
--step Step 2
Content of Step 2
::`;

      // Parse the input markdown to AST
      const ast = parseMarkdown(input);

      // Apply the modifier
      const modifiedAst = markdownModifier.modify(ast as GinkoAST);

      // Convert the modified AST back to markdown
      const result = astToMarkdown(modifiedAst as GinkoAST);

      // Verify the structure with more flexible assertions
      expect(result).toContain('::ginko-steps{level="h3"}');
      expect(result).toContain(':::ginko-step{label="Step 1"}');
      expect(result).toContain('Content of Step 1');
      expect(result).toContain(':::ginko-step{label="Step 2"}');
      expect(result).toContain('Content of Step 2');
    });

    it('should handle steps with multiple content blocks', () => {
      const markdownModifier = new MarkdownModifier([new StepsModifier()]);

      // Input markdown with steps syntax
      const input = `::steps{level="h3"}
--step Step 1
First paragraph

Second paragraph
--step Step 2
Content of Step 2
::`;

      // Parse the input markdown to AST
      const ast = parseMarkdown(input);

      // Apply the modifier
      const modifiedAst = markdownModifier.modify(ast as GinkoAST);

      // Convert the modified AST back to markdown
      const result = astToMarkdown(modifiedAst as GinkoAST);

      // Verify the structure with more flexible assertions
      expect(result).toContain('::ginko-steps{level="h3"}');
      expect(result).toContain(':::ginko-step{label="Step 1"}');
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
      expect(result).toContain(':::ginko-step{label="Step 2"}');
      expect(result).toContain('Content of Step 2');
    });
  });
}); 