import { describe, it, expect } from 'vitest'
import { CalloutModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/CalloutModifier'

describe('CalloutModifier', () => {
  const modifier = new CalloutModifier()

  describe('Ginko Callouts', () => {
    it('should handle basic Ginko callouts', () => {
      const input = `::info
Here's a callout block.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      const expected = `::ginko-callout{type="info"}
Here's a callout block.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle Ginko callouts with titles', () => {
      const input = `::info
--title Custom Title for Your Callout
Here's a callout block with a title.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      const expected = `::ginko-callout{type="info" title="Custom Title for Your Callout"}
Here's a callout block with a title.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle collapsible Ginko callouts', () => {
      const input = `::info-
This callout can be collapsed.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      const expected = `::ginko-callout{type="info" collapsed}
This callout can be collapsed.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle Ginko callouts with different types', () => {
      const types = ['note', 'tip', 'warning', 'danger']

      for (const type of types) {
        const input = `::${type}
This is a ${type} callout.
::

Some text after the callout.`

        const expected = `::ginko-callout{type="${type}"}
This is a ${type} callout.
::

Some text after the callout.`

        expect(modifier.modify(input)).toBe(expected)
      }
    })

    it('should handle Ginko callouts with title but no content', () => {
      const input = `::info
--title Title Only Callout
::

Some text after the callout.`

      const expected = `::ginko-callout{type="info" title="Title Only Callout" title-only}

::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })
  })

  describe('Obsidian Callouts', () => {
    it('should handle basic Obsidian callouts', () => {
      const input = `> [!info]
> Here's a callout block.
> It supports **Markdown**, ==highlighting==

Some text after the callout.`

      const expected = `::ginko-callout{type="info"}
Here's a callout block.
It supports **Markdown**, ==highlighting==
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle Obsidian callouts with titles', () => {
      const input = `> [!tip] Callouts can have custom titles
> Like this one.

Some text after the callout.`

      const expected = `::ginko-callout{type="tip" title="Callouts can have custom titles"}
Like this one.
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle collapsible Obsidian callouts', () => {
      const input = `> [!faq]- Are callouts foldable?
> Yes! In a foldable callout, the contents are hidden when the callout is collapsed.

Some text after the callout.`

      const expected = `::ginko-callout{type="faq" title="Are callouts foldable?" collapsed}
Yes! In a foldable callout, the contents are hidden when the callout is collapsed.
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle Obsidian callouts with different types', () => {
      const types = ['note', 'tip', 'warning', 'danger']

      for (const type of types) {
        const input = `> [!${type}]
> This is a ${type} callout.

Some text after the callout.`

        const expected = `::ginko-callout{type="${type}"}
This is a ${type} callout.
::

Some text after the callout.`

        expect(modifier.modify(input)).toBe(expected)
      }
    })

    it('should handle Obsidian callouts with pipe-separated types', () => {
      const input = `> [!note | info | tip]
> This callout has multiple types, but only the first one is used.

Some text after the callout.`

      // Create a new instance to test this specific case
      const result = modifier.modify(input)

      // Check that the result contains the expected type
      expect(result).toContain('::ginko-callout{type="note"}')
      // Check that the content is preserved
      expect(result).toContain('This callout has multiple types, but only the first one is used.')
    })
  })

  describe('Code Blocks', () => {
    it('should not process callouts inside code blocks', () => {
      const input = "```markdown\n> [!info]\n> Here's a callout block inside a code block.\n> It should not be processed.\n```\n\nText outside the code block."

      expect(modifier.modify(input)).toBe(input)
    })

    it('should process callouts outside code blocks but not inside', () => {
      const input = `> [!info]
> This callout should be processed.

\`\`\`markdown
> [!warning]
> This callout inside a code block should not be processed.
\`\`\`

> [!tip] Another callout
> This one should also be processed.`

      const result = modifier.modify(input)

      // Check that the first callout is processed
      expect(result).toContain('::ginko-callout{type="info"}')
      expect(result).toContain('This callout should be processed.')

      // Check that the code block is preserved
      expect(result).toContain('```markdown')
      expect(result).toContain('> [!warning]')
      expect(result).toContain('> This callout inside a code block should not be processed.')
      expect(result).toContain('```')

      // Check that the second callout is processed
      expect(result).toContain('::ginko-callout{type="tip" title="Another callout"}')
      expect(result).toContain('This one should also be processed.')
    })
  })

  describe('Edge Cases', () => {
    it('should handle callouts with empty content', () => {
      const input = `> [!info]
>

Some text after the callout.`

      const expected = `::ginko-callout{type="info"}

::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle callouts with content that looks like a title', () => {
      const input = `> [!info]
> Here's a callout block.

Some text after the callout.`

      const expected = `::ginko-callout{type="info"}
Here's a callout block.
::

Some text after the callout.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle multiple callouts in sequence', () => {
      const input = `> [!info]
> First callout.

> [!warning]
> Second callout.

Some text after the callouts.`

      const expected = `::ginko-callout{type="info"}
First callout.
::

::ginko-callout{type="warning"}
Second callout.
::

Some text after the callouts.`

      expect(modifier.modify(input)).toBe(expected)
    })
  })
})
