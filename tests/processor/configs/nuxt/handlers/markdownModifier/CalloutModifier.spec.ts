import { describe, it, expect } from 'vitest'
import { CalloutModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/CalloutModifier'
import type { GinkoASTNode } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/types'

describe('CalloutModifier', () => {
  const modifier = new CalloutModifier()

  describe('canHandle', () => {
    it('should return true for valid callout blocks', () => {
      const validTypes = ['note', 'tip', 'info', 'warning', 'danger', 'quote']

      for (const type of validTypes) {
        const node: GinkoASTNode = {
          type: 'block',
          name: type,
          content: [],
          properties: []
        }
        expect(modifier.canHandle(node)).toBe(true)
      }
    })

    it('should return true for collapsible callout blocks', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'info-',
        content: [],
        properties: []
      }
      expect(modifier.canHandle(node)).toBe(true)
    })

    it('should return false for non-callout blocks', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'invalid-type',
        content: [],
        properties: []
      }
      expect(modifier.canHandle(node)).toBe(false)
    })

    it('should return false for non-block nodes', () => {
      const node: GinkoASTNode = {
        type: 'text',
        content: 'Some text'
      }
      expect(modifier.canHandle(node)).toBe(false)
    })

    it('should return false for nodes without a name', () => {
      const node: GinkoASTNode = {
        type: 'block',
        content: []
      }
      expect(modifier.canHandle(node)).toBe(false)
    })
  })

  describe('modifyBlock', () => {
    it('should transform a basic callout block', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'note',
        content: [{ type: 'text', content: 'Content' }],
        properties: []
      }

      const result = modifier.modifyBlock(node)

      expect(result.name).toBe('ginko-callout')
      expect(result.properties).toEqual([
        { name: 'type', value: 'note' }
      ])
      expect(result.content).toEqual([{ type: 'text', content: 'Content' }])
    })

    it('should transform a collapsible callout block', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'info-',
        content: [{ type: 'text', content: 'Content' }],
        properties: []
      }

      const result = modifier.modifyBlock(node)

      expect(result.name).toBe('ginko-callout')
      expect(result.properties).toContainEqual({ name: 'type', value: 'info' })
      expect(result.properties).toContainEqual({ name: 'collapsed', value: true })
      expect(result.content).toEqual([{ type: 'text', content: 'Content' }])
    })

    it('should extract title from dash-element', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'warning',
        content: [
          {
            type: 'dash-element',
            name: 'title',
            label: 'Custom Title',
            content: [],
            properties: []
          },
          { type: 'text', content: 'Content' }
        ],
        properties: []
      }

      const result = modifier.modifyBlock(node)

      expect(result.name).toBe('ginko-callout')
      expect(result.properties).toContainEqual({ name: 'type', value: 'warning' })
      expect(result.properties).toContainEqual({ name: 'title', value: 'Custom Title' })
      expect(result.content).toEqual([{ type: 'text', content: 'Content' }])
    })

    it('should preserve existing properties', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'tip',
        content: [{ type: 'text', content: 'Content' }],
        properties: [{ name: 'size', value: 'large' }]
      }

      const result = modifier.modifyBlock(node)

      expect(result.name).toBe('ginko-callout')
      expect(result.properties).toContainEqual({ name: 'type', value: 'tip' })
      expect(result.properties).toContainEqual({ name: 'size', value: 'large' })
    })

    it('should not modify non-callout blocks', () => {
      const node: GinkoASTNode = {
        type: 'block',
        name: 'not-a-callout',
        content: [{ type: 'text', content: 'Content' }],
        properties: []
      }

      const result = modifier.modifyBlock(node)
      expect(result).toEqual(node)
    })
  })
})

