import { describe, it, expect } from 'vitest'
import { LayoutModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/LayoutModifier'

describe('LayoutModifier', () => {
  const layoutModifier = new LayoutModifier()

  it('should convert a single column layout to ginko-center', () => {
    const input = `::layout
--col
Single column content
::`

    const expected = `::ginko-center
Single column content
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should convert a single column layout with props to ginko-layout with col', () => {
    const input = `::layout
--col(size="lg")
Single column with props
::`

    const expected = `::ginko-layout
::col{size="lg"}
Single column with props
::
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should convert a multi-column layout to ginko-layout with ginko-column', () => {
    const input = `::layout
--col
First column
--col
Second column
::`

    const expected = `::ginko-layout
::ginko-column
First column
::
::ginko-column
Second column
::
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should preserve indentation in layout blocks', () => {
    const input = `  ::layout
  --col
  Indented content
  ::`

    const expected = `  ::ginko-center
  Indented content
  ::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should NOT convert layout syntax inside code blocks', () => {
    const input = "```markdown\n::layout\n--col\nThis is inside a code block\n::\n```"

    // The output should be identical to the input
    expect(layoutModifier.modify(input)).toBe(input)
  })

  it('should convert layout blocks outside code blocks but preserve those inside', () => {
    const input = `::layout
--col
Real layout outside code block
::

\`\`\`markdown
::layout
--col
Example layout inside code block
::
\`\`\`

::layout
--col
Another real layout
::`

    const expected = `::ginko-center
Real layout outside code block
::

\`\`\`markdown
::layout
--col
Example layout inside code block
::
\`\`\`

::ginko-center
Another real layout
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should handle complex documentation example with code blocks', () => {
    // Get the actual output from the modifier
    const input = `# Layout

The Layout feature lets you arrange content in columns to create visually balanced pages and improve readability.

## Basic Syntax

To create a layout, use the \`::layout\` container with each column defined by \`--col\`:

\`\`\`markdown
::layout
--col
Your content goes here
::
\`\`\`

## Column Configurations

### Single Column

A single column layout centers content on the page, making it ideal for focused reading:

\`\`\`markdown
::layout
--col
Use one Column to center the text
::
\`\`\`

**This renders as:**

::layout
--col
Use one Column to center the text
::

### Two Columns

Split content into two equal columns to display related information side by side:

\`\`\`markdown
::layout
--col
Use two columns
--col
Use two columns
::
\`\`\`

**This renders as:**

::layout
--col
Use two columns
--col
Use two columns
::`;

    const output = layoutModifier.modify(input);

    // Verify that code blocks are preserved
    expect(output).toContain("```markdown\n::layout\n--col\nYour content goes here\n::\n```");
    expect(output).toContain("```markdown\n::layout\n--col\nUse one Column to center the text\n::\n```");
    expect(output).toContain("```markdown\n::layout\n--col\nUse two columns\n--col\nUse two columns\n::\n```");

    // Verify that actual layout blocks are converted
    expect(output).toContain("::ginko-center\nUse one Column to center the text\n::");
    expect(output).toContain("::ginko-layout\n::ginko-column\nUse two columns\n::\n::ginko-column\nUse two columns\n::\n::");
  })

  // New tests for type property
  it('should apply type property to single column layout', () => {
    const input = `::layout(type="border")
--col
Content with border type
::`

    const expected = `::ginko-center{type="border"}
Content with border type
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should apply type property to multi-column layout', () => {
    const input = `::layout(type="card")
--col
First column
--col
Second column
::`

    const expected = `::ginko-layout{type="card"}
::ginko-column
First column
::
::ginko-column
Second column
::
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should apply type property to single column layout with props', () => {
    const input = `::layout(type="outline")
--col(size="lg")
Content with outline type
::`

    const expected = `::ginko-layout{type="outline"}
::col{size="lg"}
Content with outline type
::
::`

    expect(layoutModifier.modify(input)).toBe(expected)
  })

  it('should handle various type values', () => {
    const types = ['border', 'outline', 'border-dashed', 'outline-dashed', 'card', 'none']

    for (const type of types) {
      const input = `::layout(type="${type}")
--col
Content with ${type} type
--col
Another column
::`

      const expected = type === 'none'
        ? `::ginko-layout
::ginko-column
Content with none type
::
::ginko-column
Another column
::
::`
        : `::ginko-layout{type="${type}"}
::ginko-column
Content with ${type} type
::
::ginko-column
Another column
::
::`

      expect(layoutModifier.modify(input)).toBe(expected)
    }
  })

  it('should NOT convert type parameters inside code blocks', () => {
    const input = "```markdown\n::layout(type=\"border\")\n--col\nThis is inside a code block\n::\n```"

    // The output should be identical to the input
    expect(layoutModifier.modify(input)).toBe(input)
  })

  it('should handle type examples from documentation', () => {
    const input = `**Border Type:**
\`\`\`markdown
::layout(type="border")
--col
Content in column one
--col
Content in column two
::
\`\`\`

::layout(type="border")
--col
Content in column one
--col
Content in column two
::`

    const output = layoutModifier.modify(input)

    // Code block should be preserved
    expect(output).toContain("```markdown\n::layout(type=\"border\")\n--col\nContent in column one\n--col\nContent in column two\n::\n```")

    // Actual layout should be converted with type
    expect(output).toContain("::ginko-layout{type=\"border\"}\n::ginko-column\nContent in column one\n::\n::ginko-column\nContent in column two\n::\n::")
  })
})
