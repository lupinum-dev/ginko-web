import type { ContentModifier } from '../../markdownModifier'
import { stripMarkdown } from '../../utils/markdown'

export class CalloutModifier implements ContentModifier {
  // Match both new and old style callouts
  private readonly NEW_CALLOUT_REGEX = /^::((?:note|warning|info|danger|tip|quiz)(?:-)?)(?:\s*(?:-|\+)?(?:\s*--title\s+([^\n]+))?)?\n([\s\S]*?)^::/gm
  // Updated regex to better handle title and content separation with proper line handling
  // Also handle pipe-separated types by allowing pipe characters in the type capture group
  private readonly OBSIDIAN_CALLOUT_REGEX = /^>\s*\[!([\w\s|]+)\](\-|\+)?(?:\s+([^\n]+))?\n((?:>\s*[^\n]*(?:\n|$))*)/gm
  private readonly CODE_BLOCK_REGEX = /```[\s\S]*?```/g

  modify(content: string): string {
    // Split content into code blocks and non-code blocks
    const segments: { isCode: boolean; content: string }[] = []
    let lastIndex = 0

    content.replace(this.CODE_BLOCK_REGEX, (match, offset) => {
      // Add text before code block
      if (offset > lastIndex) {
        segments.push({
          isCode: false,
          content: content.slice(lastIndex, offset)
        })
      }
      // Add code block
      segments.push({
        isCode: true,
        content: match
      })
      lastIndex = offset + match.length
      return match
    })

    // Add remaining content after last code block
    if (lastIndex < content.length) {
      segments.push({
        isCode: false,
        content: content.slice(lastIndex)
      })
    }

    // Process each segment
    return segments.map(segment => {
      if (segment.isCode) {
        return segment.content
      }
      return this.processNonCodeContent(segment.content)
    }).join('')
  }

  private processNonCodeContent(content: string): string {
    // First handle new style callouts
    let processedContent = content.replace(this.NEW_CALLOUT_REGEX, (match, type: string, title: string | undefined, content: string) => {
      // Extract collapse state and title from the type if present
      const isCollapsed = type.endsWith('-') ? ' collapsed' : ''
      const baseType = type.replace(/-$/, '') // Remove trailing dash if present

      // Clean up content and remove any trailing whitespace
      const cleanContent = content.trim()

      // Construct title attribute if present
      const titleAttr = title ? ` title="${title}"` : ''
      // If there is a title but no content, add "title-only" property
      const extraProp = cleanContent === '' && titleAttr ? ' title-only' : ''

      // Construct the ginko-callout with extraProp if no content is provided but title exists
      return `::ginko-callout{type="${baseType}"${titleAttr}${extraProp}${isCollapsed}}\n${cleanContent}\n::`
    })

    // Then handle Obsidian-style callouts
    processedContent = processedContent.replace(this.OBSIDIAN_CALLOUT_REGEX, (
      match: string,
      type: string,
      collapsible: string | undefined,
      title: string | undefined,
      contentText: string | undefined
    ) => {
      // Clean up type (handle pipe-separated types by taking the first one)
      const cleanType = type.split('|')[0].trim().toLowerCase()

      // Determine if callout is collapsed (has the '-' symbol)
      const isCollapsed = collapsible === '-' ? ' collapsed' : ''

      // Handle title if present - only use it if it doesn't start with '>'
      // This prevents the first line of content from being treated as a title
      const titleAttr = title && !title.trim().startsWith('>') ? ` title="${title.trim()}"` : ''

      // Process content
      let cleanedContent = ''
      if (contentText) {
        cleanedContent = contentText
          .split('\n')
          .map(line => line.replace(/^>\s*/, '').trimEnd())
          .filter(line => line.length > 0)
          .join('\n')
      }

      // If title starts with '>', it's actually content that was incorrectly captured as title
      if (title && title.trim().startsWith('>')) {
        const titleContent = title.replace(/^>\s*/, '').trim()
        cleanedContent = titleContent + (cleanedContent ? '\n' + cleanedContent : '')
      }

      // If there's no content but there is a title, add title-only property
      const extraProp = !cleanedContent && titleAttr ? ' title-only' : ''

      // Construct the ginko-callout
      return `::ginko-callout{type="${cleanType}"${titleAttr}${extraProp}${isCollapsed}}\n${cleanedContent}\n::`
    })

    // Ensure proper spacing between callouts by adding an extra newline
    processedContent = processedContent.replace(/\n::\n::/g, '\n::\n\n::')
    // Ensure there is an empty line after a callout block if not already present
    processedContent = processedContent.replace(/(::\n)(?!\n)/g, '$1\n')

    return processedContent
  }
}

