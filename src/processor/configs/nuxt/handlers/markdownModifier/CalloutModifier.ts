import type { ContentModifier } from '../../markdownModifier'
import { stripMarkdown } from '../../utils/markdown'

export class CalloutModifier implements ContentModifier {
  // Match both new and old style callouts
  private readonly NEW_CALLOUT_REGEX = /^::((?:note|warning|info|danger|tip)(?:-)?)(?:\s*(?:-|\+)?(?:\s*--title\s+([^\n]+))?)?\n([\s\S]*?)^::/gm
  private readonly OBSIDIAN_CALLOUT_REGEX = /^>\s*\[!\s*(\w+)\](\-|\+)?(?:[ \t]+([^\n]+))?\n((?:>(?:.*?)(?:\n|$))*)/gm

  modify(content: string): string {
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
      collapsible: string,
      inlineTitle: string | undefined,
      contentText: string
    ) => {
      // Determine if callout is collapsed (has the '-' symbol)
      const isCollapsed = collapsible === '-' ? ' collapsed' : ''

      // Split the callout content into lines (preserving empty lines)
      let lines = contentText.split('\n')

      // Determine title attribute only if provided inline.
      let titleAttr = ''
      if (inlineTitle && inlineTitle.trim()) {
        titleAttr = ` title="${inlineTitle.trim()}"`
      }

      // Now clean up remaining content lines:
      // Remove the leading '>' from each line while preserving empty lines,
      // and skip any lines that are image embeds (starting with "![[").
      const cleanedContent = lines
        .map((line: string) => {
          // If the line is exactly a '>' then ignore it
          if (line.trim() === '>') return ''
          const cleanedLine = line.replace(/^>\s?/, '')
          return cleanedLine.trim().startsWith('![[') ? null : cleanedLine
        })
        .filter((line) => line !== null)
        .join('\n')
        .trim()

      // If there's no remaining content, check for a title-only condition
      if (!cleanedContent) {
        const extraProp = titleAttr ? ' title-only' : ''
        return `::ginko-callout{type="${type.toLowerCase()}"${titleAttr}${extraProp}${isCollapsed}}\n::`
      }

      // Construct the ginko-callout with the inline title (if provided) and cleaned content
      return `::ginko-callout{type="${type.toLowerCase()}"${titleAttr}${isCollapsed}}\n${cleanedContent}\n::`
    })

    // Ensure proper spacing between callouts by adding an extra newline
    processedContent = processedContent.replace(/\n::\n::/g, '\n::\n\n::')
    // Ensure there is an empty line after a callout block if not already present
    processedContent = processedContent.replace(/(::\n)(?!\n)/g, '$1\n')

    return processedContent
  }
}

