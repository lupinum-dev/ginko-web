import { describe, it, expect } from 'vitest'
import { astToMarkdown } from '../../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/utils/astToMarkdown'
import type { GinkoAST } from '../../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/types'

describe('astToMarkdown', () => {
  it('should convert a simple text node to markdown', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        { type: 'text', content: 'Simple text' }
      ]
    }

    const result = astToMarkdown(ast)

    expect(result).toBe('Simple text')
  })

  it('should convert multiple text nodes to markdown', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        { type: 'text', content: 'First paragraph\n' },
        { type: 'text', content: 'Second paragraph' }
      ]
    }

    const result = astToMarkdown(ast)

    expect(result).toBe('First paragraph\nSecond paragraph')
  })

  it('should convert a block with no properties to markdown', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'test',
          content: [{ type: 'text', content: 'Block content' }],
          properties: []
        }
      ]
    }

    const expected = '::test\nBlock content\n::\n'
    const result = astToMarkdown(ast)

    expect(result).toBe(expected)
  })

  it('should convert a block with properties to markdown using curly braces', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'test',
          content: [{ type: 'text', content: 'Block content' }],
          properties: [
            { name: 'prop1', value: 'value1' },
            { name: 'prop2', value: 'value2' }
          ]
        }
      ]
    }

    const expected = '::test{prop1="value1" prop2="value2"}\nBlock content\n::\n'
    const result = astToMarkdown(ast)

    expect(result).toBe(expected)
  })

  it('should handle boolean property values', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'test',
          content: [{ type: 'text', content: 'Block content' }],
          properties: [
            { name: 'flag', value: true }
          ]
        }
      ]
    }

    const expected = '::test{flag}\nBlock content\n::\n'
    const result = astToMarkdown(ast)

    expect(result).toBe(expected)
  })

  it('should omit false boolean properties', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'test',
          content: [{ type: 'text', content: 'Block content' }],
          properties: [
            { name: 'visible', value: true },
            { name: 'hidden', value: false }
          ]
        }
      ]
    }

    const expected = '::test{visible}\nBlock content\n::\n'
    const result = astToMarkdown(ast)

    expect(result).toBe(expected)
  })

  it('should handle nested blocks', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        {
          type: 'block',
          name: 'outer',
          content: [
            { type: 'text', content: 'Outer content\n' },
            {
              type: 'block',
              name: 'inner',
              content: [{ type: 'text', content: 'Inner content' }],
              properties: []
            }
          ],
          properties: []
        }
      ]
    }

    const expected = '::outer\nOuter content\n::inner\nInner content\n::\n\n::\n'
    const result = astToMarkdown(ast)

    expect(result).toBe(expected)
  })

  it('should handle a complex document with mixed content', () => {
    const ast: GinkoAST = {
      type: 'document',
      content: [
        { type: 'text', content: 'Text before\n' },
        {
          type: 'block',
          name: 'ginko-callout',
          content: [{ type: 'text', content: 'Callout content' }],
          properties: [
            { name: 'type', value: 'note' },
            { name: 'title', value: 'Note Title' },
            { name: 'collapsed', value: true }
          ]
        },
        { type: 'text', content: '\nText after' }
      ]
    }

    const expected = 'Text before\n::ginko-callout{type="note" title="Note Title" collapsed}\nCallout content\n::\n\nText after'
    const result = astToMarkdown(ast)

    expect(result).toBe(expected)
  })
}) 