import { describe, it, expect, vi } from 'vitest'
import { CalloutModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/CalloutModifier'
import { MarkdownModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/MarkdownModifier'
import { astToMarkdown } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/utils/astToMarkdown'
import { mockParseMarkdown } from './mocks/ginkoParser.mock'

// Mock the parseMarkdown function
vi.mock('../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/utils/ginkoParser', () => ({
  parseMarkdown: (input: string) => mockParseMarkdown(input)
}))

describe('Markdown Modification Integration', () => {
  // Create the modifier chain
  const calloutModifier = new CalloutModifier()
  const markdownModifier = new MarkdownModifier([calloutModifier])

  function processMarkdown(input: string): string {
    const ast = mockParseMarkdown(input)
    const modifiedAst = markdownModifier.modify(ast)

    if ('error' in modifiedAst) {
      throw new Error(`Error processing markdown: ${modifiedAst.error}`)
    }

    return astToMarkdown(modifiedAst)
  }

  it('should transform a basic callout', () => {
    const input = `Above Callout
::note
Inner
::
Below Callout`

    // Process the markdown and check that it contains the expected transformations
    const result = processMarkdown(input)
    expect(result).toContain('Above Callout')
    expect(result).toContain('::ginko-callout{type="note"}')
    expect(result).toContain('Inner')
    expect(result).toContain('Below Callout')
  })

  it('should transform a callout with properties', () => {
    const input = `::note{size="lol"}
Inner
::`

    // Process the markdown and check that it contains the expected transformations
    const result = processMarkdown(input)
    expect(result).toContain('::ginko-callout{type="note" size="lol"}')
    expect(result).toContain('Inner')
  })

  it('should transform a collapsible callout', () => {
    const input = `::info-
Collapsible content
::`

    // Process the markdown and check that it contains the expected transformations
    const result = processMarkdown(input)
    expect(result).toContain('::ginko-callout{type="info" collapsed}')
    expect(result).toContain('Collapsible content')
  })

  it('should extract title from dash-element', () => {
    const input = `::info
--title Custom Title for Your Callout
Here's a callout block with a title.
::`

    // Process the markdown and check that it contains the expected transformations
    const result = processMarkdown(input)
    expect(result).toContain('::ginko-callout{type="info" title="Custom Title for Your Callout"}')
    expect(result).toContain('Here\'s a callout block with a title.')
  })
}) 