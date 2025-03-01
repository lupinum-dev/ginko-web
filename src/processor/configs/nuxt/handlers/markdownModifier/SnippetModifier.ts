import type { ContentModifier } from '../../markdownModifier'

export class SnippetModifier implements ContentModifier {
  // Match block snippets
  private readonly BLOCK_SNIPPET_REGEX = /^::snippet\(id="([^"]+)"\)\n([\s\S]*?)^::/gm
  // Match inline snippets
  private readonly INLINE_SNIPPET_REGEX = /:snippet\(id="([^"]+)"\)/g

  modify(content: string): string {
    // First, extract all block snippets and their content
    const snippets = new Map<string, string>()
    content = content.replace(this.BLOCK_SNIPPET_REGEX, (match, id, snippetContent) => {
      snippets.set(id, snippetContent.trim())
      return '' // Remove the block snippet
    })

    // Then replace all inline snippets with their content
    return content.replace(this.INLINE_SNIPPET_REGEX, (match, id) => {
      const snippetContent = snippets.get(id)
      if (!snippetContent) {
        console.error(`Snippet with id ${id} not found`)
        return match
      }

      // Format the content: escape quotes and preserve newlines
      const formattedContent = this.escapeQuotes(snippetContent)
      return `<ginko-snippet>${formattedContent}</ginko-snippet>`
    })
  }

  private escapeQuotes(str: string): string {
    return str
      .replace(/\\/g, '\\\\') // First escape backslashes
      .replace(/</g, '&lt;')  // Escape < to prevent HTML injection
      .replace(/>/g, '&gt;')  // Escape > to prevent HTML injection
      .replace(/\n/g, '<br>') // Replace newlines with <br> tags
  }


}
