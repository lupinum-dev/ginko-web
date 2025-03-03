import { describe, it, expect } from 'vitest';
import { TabsModifier } from '../TabsModifier';
import type { GinkoASTNode } from '../types';

describe('TabsModifier', () => {
  const modifier = new TabsModifier();

  describe('canHandle', () => {
    it('should handle tabs blocks', () => {
      expect(modifier.canHandle({ type: 'block', name: 'tabs' } as GinkoASTNode)).toBe(true);
    });

    it('should not handle other blocks', () => {
      expect(modifier.canHandle({ type: 'block', name: 'note' } as GinkoASTNode)).toBe(false);
      expect(modifier.canHandle({ type: 'text', content: 'text' } as GinkoASTNode)).toBe(false);
    });
  });

  describe('modifyBlock', () => {
    it('should transform tabs block to ginko-tabs', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'tabs',
        properties: [],
        content: [
          {
            type: 'dash-element',
            name: 'tab',
            properties: [],
            content: [{ type: 'text', content: 'Content 1\n' }],
            label: 'Label 1'
          },
          {
            type: 'dash-element',
            name: 'tab',
            properties: [{ name: 'icon', value: 'server' }],
            content: [{ type: 'text', content: 'Content 2\n' }],
            label: 'Label 2'
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-tabs',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-tab',
            properties: [{ name: 'label', value: 'Label 1' }],
            content: [{ type: 'text', content: 'Content 1\n' }]
          },
          {
            type: 'block',
            name: 'ginko-tab',
            properties: [
              { name: 'icon', value: 'server' },
              { name: 'label', value: 'Label 2' }
            ],
            content: [{ type: 'text', content: 'Content 2\n' }]
          }
        ]
      });
    });

    it('should preserve tabs properties', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'tabs',
        properties: [{ name: 'type', value: 'code' }],
        content: [
          {
            type: 'dash-element',
            name: 'tab',
            properties: [],
            content: [{ type: 'text', content: 'Content 1\n' }],
            label: 'Label 1'
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-tabs',
        properties: [{ name: 'type', value: 'code' }],
        content: [
          {
            type: 'block',
            name: 'ginko-tab',
            properties: [{ name: 'label', value: 'Label 1' }],
            content: [{ type: 'text', content: 'Content 1\n' }]
          }
        ]
      });
    });

    it('should handle tabs without labels', () => {
      const input: GinkoASTNode = {
        type: 'block',
        name: 'tabs',
        properties: [],
        content: [
          {
            type: 'dash-element',
            name: 'tab',
            properties: [{ name: 'icon', value: 'server' }],
            content: [{ type: 'text', content: 'Content 1\n' }]
          }
        ]
      };

      const result = modifier.modifyBlock(input);
      expect(result).toEqual({
        type: 'block',
        name: 'ginko-tabs',
        properties: [],
        content: [
          {
            type: 'block',
            name: 'ginko-tab',
            properties: [{ name: 'icon', value: 'server' }],
            content: [{ type: 'text', content: 'Content 1\n' }]
          }
        ]
      });
    });
  });
});