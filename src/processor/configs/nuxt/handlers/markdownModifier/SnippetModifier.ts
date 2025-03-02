import type { ContentModifier } from '../../markdownModifier'

export class SnippetModifier implements ContentModifier {
  // Match block snippets - non-greedy match between markers
  private readonly BLOCK_SNIPPET_REGEX = /^::snippet\(id="([^"]+)"\)\s*([\s\S]*?)^\s*::\s*$/gm
  // Match inline snippets
  private readonly INLINE_SNIPPET_REGEX = /:snippet\(id="([^"]+)"\)/g

  modify(content: string): string {
    // First, transform block snippets
    content = content.replace(this.BLOCK_SNIPPET_REGEX, (match, id, snippetContent) => {
      return `::ginko-snippet-source{id="${id}"}\n${snippetContent.trim()}\n::`
    })

    // Then transform inline snippets
    return content.replace(this.INLINE_SNIPPET_REGEX, (match, id) => {
      return `:ginko-snippet{id="${id}"}`
    })
  }
}
