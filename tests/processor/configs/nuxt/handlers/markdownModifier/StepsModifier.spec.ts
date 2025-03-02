import { describe, it, expect } from 'vitest'
import { StepsModifier } from '../../../../../../src/processor/configs/nuxt/handlers/markdownModifier/StepsModifier'

describe('StepsModifier', () => {
  const modifier = new StepsModifier()

  describe('Basic Steps Syntax', () => {
    it('should convert basic steps syntax to ginko-steps components', () => {
      const input = `::steps
--step Step 1
Content of Step 1
--step Step 2
Content of Step 2
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Step 1" step="1"} 
Content of Step 1
::
::ginko-step{title="Step 2" step="2"} 
Content of Step 2
::
::

Some text after the steps.`

      const result = modifier.modify(input)
      console.log('Expected:', JSON.stringify(expected))
      console.log('Actual:', JSON.stringify(result))
      expect(result).toBe(expected)
    })

    it('should handle steps with multiline content', () => {
      const input = `::steps
--step Step 1
This is the first line of content.
This is the second line of content.

This is a new paragraph.
--step Step 2
Another step with multiple lines.
And more content.
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Step 1" step="1"} 
This is the first line of content.
This is the second line of content.

This is a new paragraph.
::
::ginko-step{title="Step 2" step="2"} 
Another step with multiple lines.
And more content.
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle steps with markdown content', () => {
      const input = `::steps
--step Step with Markdown
This step has **bold** and *italic* text.
- List item 1
- List item 2

\`\`\`js
console.log('Code block inside a step');
\`\`\`
--step Another Step
More content here.
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Step with Markdown" step="1"} 
This step has **bold** and *italic* text.
- List item 1
- List item 2

\`\`\`js
console.log('Code block inside a step');
\`\`\`
::
::ginko-step{title="Another Step" step="2"} 
More content here.
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })
  })

  describe('Customization Options', () => {
    it('should handle heading level customization', () => {
      const input = `::steps(level="h3")
--step Step 1
Content of Step 1
--step Step 2
Content of Step 2
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h3"}
::ginko-step{title="Step 1" step="1"} 
Content of Step 1
::
::ginko-step{title="Step 2" step="2"} 
Content of Step 2
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle steps with icons', () => {
      const input = `::steps
--step(icon="server") Step 1
Content of Step 1
--step(icon="cif:at") Step 2
Content of Step 2
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Step 1" step="1" icon="server"} 
Content of Step 1
::
::ginko-step{title="Step 2" step="2" icon="cif:at"} 
Content of Step 2
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle additional props on steps container', () => {
      const input = `::steps(prop test="123")
--step Step 1
Content of Step 1
--step Step 2
Content of Step 2
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2" test="123" prop}
::ginko-step{title="Step 1" step="1"} 
Content of Step 1
::
::ginko-step{title="Step 2" step="2"} 
Content of Step 2
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle additional props on individual steps', () => {
      const input = `::steps
--step(xy lulu="Insane") Step 1
Content of Step 1
--step Step 2
Content of Step 2
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Step 1" step="1" lulu="Insane" xy} 
Content of Step 1
::
::ginko-step{title="Step 2" step="2"} 
Content of Step 2
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })
  })

  describe('Advanced Usage', () => {
    it('should handle steps with code blocks', () => {
      const input = `::steps
--step(icon="file-text") Create your configuration file
Create a new file named \`config.json\` with the following structure:
\`\`\`json
{
  "apiKey": "your-key-here",
  "endpoint": "https://api.example.com"
}
\`\`\`
--step(icon="terminal") Run the installation command
Execute the following in your terminal:
\`\`\`bash
npm install @ginko/client
\`\`\`
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Create your configuration file" step="1" icon="file-text"} 
Create a new file named \`config.json\` with the following structure:
\`\`\`json
{
  "apiKey": "your-key-here",
  "endpoint": "https://api.example.com"
}
\`\`\`
::
::ginko-step{title="Run the installation command" step="2" icon="terminal"} 
Execute the following in your terminal:
\`\`\`bash
npm install @ginko/client
\`\`\`
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should not process steps syntax inside code blocks', () => {
      const input = "```markdown\n::steps\n--step Step 1\nContent of Step 1\n--step Step 2\nContent of Step 2\n::\n```\n\nText outside the code block."

      expect(modifier.modify(input)).toBe(input)
    })

    it('should process steps outside code blocks but not inside', () => {
      const input = `::steps
--step Step 1
This step should be processed.
--step Step 2
This step should also be processed.
::

\`\`\`markdown
::steps
--step Step A
This step inside a code block should not be processed.
--step Step B
This step inside a code block should not be processed.
::
\`\`\`

::steps
--step Step 3
This step should be processed.
::

Some text after the steps.`

      const result = modifier.modify(input)

      // Check that the first steps block is processed
      expect(result).toContain('::ginko-steps{level="h2"}')
      expect(result).toContain('::ginko-step{title="Step 1" step="1"}')
      expect(result).toContain('This step should be processed.')
      expect(result).toContain('::ginko-step{title="Step 2" step="2"}')
      expect(result).toContain('This step should also be processed.')

      // Check that the code block is preserved
      expect(result).toContain('```markdown')
      expect(result).toContain('::steps')
      expect(result).toContain('--step Step A')
      expect(result).toContain('This step inside a code block should not be processed.')
      expect(result).toContain('```')

      // Check that the second steps block is processed
      expect(result).toContain('::ginko-step{title="Step 3" step="1"}')
      expect(result).toContain('This step should be processed.')
    })
  })

  describe('Edge Cases', () => {
    it('should handle steps with empty content', () => {
      const input = `::steps
--step Step 1

--step Step 2
Content of Step 2
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h2"}
::ginko-step{title="Step 1" step="1"} 

::
::ginko-step{title="Step 2" step="2"} 
Content of Step 2
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })

    it('should handle multiple steps blocks in the same content', () => {
      const input = `# First Steps Block

::steps
--step Step 1
Content of Step 1
--step Step 2
Content of Step 2
::

# Second Steps Block

::steps(level="h3")
--step Step A
Content of Step A
--step Step B
Content of Step B
::

Some text after the steps.`

      const result = modifier.modify(input)

      // Check that both steps blocks are processed
      expect(result).toContain('# First Steps Block')
      expect(result).toContain('::ginko-steps{level="h2"}')
      expect(result).toContain('::ginko-step{title="Step 1" step="1"}')
      expect(result).toContain('Content of Step 1')
      expect(result).toContain('::ginko-step{title="Step 2" step="2"}')
      expect(result).toContain('Content of Step 2')

      expect(result).toContain('# Second Steps Block')
      expect(result).toContain('::ginko-steps{level="h3"}')
      expect(result).toContain('::ginko-step{title="Step A" step="1"}')
      expect(result).toContain('Content of Step A')
      expect(result).toContain('::ginko-step{title="Step B" step="2"}')
      expect(result).toContain('Content of Step B')
    })

    it('should handle steps with complex attribute combinations', () => {
      const input = `::steps(level="h4" theme="dark" custom)
--step(icon="gear" highlight="true" custom="value") Complex Step
Content with **markdown** and \`code\`.
::

Some text after the steps.`

      const expected = `::ginko-steps{level="h4" theme="dark" custom}
::ginko-step{title="Complex Step" step="1" icon="gear" highlight="true" custom="value"} 
Content with **markdown** and \`code\`.
::
::

Some text after the steps.`

      expect(modifier.modify(input)).toBe(expected)
    })
  })
})