import { describe, it, expect, vi } from 'vitest'
import { MarkdownModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/MarkdownModifier'
import type { BlockModifier, GinkoAST, GinkoASTNode } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/types'

// Mock block modifier
class MockBlockModifier implements BlockModifier {
  canHandle = vi.fn()
  modifyBlock = vi.fn()
}

describe('MarkdownModifier', () => {
  let mockModifier: MockBlockModifier

  beforeEach(() => {
    mockModifier = new MockBlockModifier()
    mockModifier.canHandle.mockImplementation((node) => node.type === 'block' && node.name === 'test-block')
    mockModifier.modifyBlock.mockImplementation((node) => ({
      ...node,
      name: 'modified-block'
    }))
  })

  describe('modify', () => {
    it('should return the error object if provided', () => {
      const modifier = new MarkdownModifier([mockModifier])
      const errorObj = { error: 'Test error' }

      const result = modifier.modify(errorObj)

      expect(result).toBe(errorObj)
    })

    it('should return an empty document for undefined or invalid AST', () => {
      const modifier = new MarkdownModifier([mockModifier])

      // @ts-ignore - Testing invalid input
      const result = modifier.modify(undefined)

      expect(result).toEqual({
        type: 'document',
        content: []
      })
    })

    it('should apply modifiers to matching nodes', () => {
      const modifier = new MarkdownModifier([mockModifier])

      const ast: GinkoAST = {
        type: 'document',
        content: [
          { type: 'text', content: 'Text before' },
          {
            type: 'block',
            name: 'test-block',
            content: [{ type: 'text', content: 'Block content' }],
            properties: []
          },
          { type: 'text', content: 'Text after' }
        ]
      }

      const result = modifier.modify(ast)

      expect(mockModifier.canHandle).toHaveBeenCalled()
      expect(mockModifier.modifyBlock).toHaveBeenCalled()

      // Check that the block was modified
      expect(result).toEqual({
        type: 'document',
        content: [
          { type: 'text', content: 'Text before' },
          {
            type: 'block',
            name: 'modified-block',
            content: [{ type: 'text', content: 'Block content' }],
            properties: []
          },
          { type: 'text', content: 'Text after' }
        ]
      })
    })

    it('should handle nested blocks', () => {
      const modifier = new MarkdownModifier([mockModifier])

      const ast: GinkoAST = {
        type: 'document',
        content: [
          {
            type: 'block',
            name: 'outer-block',
            content: [
              { type: 'text', content: 'Outer text' },
              {
                type: 'block',
                name: 'test-block',
                content: [{ type: 'text', content: 'Inner content' }],
                properties: []
              }
            ],
            properties: []
          }
        ]
      }

      const result = modifier.modify(ast)

      // The inner test-block should be modified
      const innerBlock = (result as GinkoAST).content[0].content?.[1] as GinkoASTNode
      expect(innerBlock.name).toBe('modified-block')
    })

    it('should handle errors during modification', () => {
      const errorModifier = new MockBlockModifier()
      errorModifier.canHandle.mockReturnValue(true)
      errorModifier.modifyBlock.mockImplementation(() => {
        throw new Error('Test error')
      })

      const modifier = new MarkdownModifier([errorModifier])

      const ast: GinkoAST = {
        type: 'document',
        content: [
          {
            type: 'block',
            name: 'test-block',
            content: [],
            properties: []
          }
        ]
      }

      const result = modifier.modify(ast)

      expect(result).toHaveProperty('error')
      expect((result as { error: string }).error).toContain('Test error')
    })
  })
}) 