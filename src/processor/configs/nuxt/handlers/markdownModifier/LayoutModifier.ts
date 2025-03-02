import type { ContentModifier } from '../../markdownModifier'
import type { ComponentInfo } from './types/ComponentInfo'
import { getComponentInfo } from './utils/componentParser'

export class LayoutModifier implements ContentModifier {
  // Match layout block with new syntax - updated to match layout with optional parameters
  private readonly LAYOUT_REGEX = /^([ \t]*)::layout(?:\(([^)]*)\))?\n([\s\S]*?)^\1::/gm
  // Match code blocks (both fenced and indented)
  private readonly CODE_BLOCK_REGEX = /```[\s\S]*?```|`{3}[\s\S]*?`{3}/g

  modify(content: string): string {
    // First, identify all code blocks and create a map of protected regions
    const codeBlocks: { start: number; end: number }[] = []
    let match

    while ((match = this.CODE_BLOCK_REGEX.exec(content)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length
      })
    }

    // Reset regex lastIndex
    this.LAYOUT_REGEX.lastIndex = 0

    // Process layout blocks, but skip those inside code blocks
    return content.replace(this.LAYOUT_REGEX, (match, indent = '', params = '', innerContent, offset) => {
      // Check if this match is inside any code block
      const isInsideCodeBlock = codeBlocks.some(
        block => offset >= block.start && offset < block.end
      )

      // If inside a code block, return the original match unchanged
      if (isInsideCodeBlock) {
        return match
      }

      // Parse type parameter if present
      const typeMatch = params.match(/type\s*=\s*["']([^"']*)["']/)
      const type = typeMatch ? typeMatch[1] : null

      // For indented blocks, we need to normalize the content by removing the indentation
      // before parsing, then add it back when formatting
      const normalizedMatch = match.replace(new RegExp(`^${indent}`, 'gm'), '')

      // Otherwise, process the layout block as usual
      const componentInfo = this.getComponentInfo(normalizedMatch)
      if (!componentInfo) {
        console.error('Failed to parse component info')
        return match
      }

      // Add type to component props if it's not 'none' and not null
      if (type && type !== 'none') {
        componentInfo.props = componentInfo.props || {}
        componentInfo.props.type = type
      }

      return this.formatLayout(componentInfo, indent)
    })
  }

  getComponentInfo(content: string): ComponentInfo | null {
    return getComponentInfo(content)
  }

  private formatLayout(componentInfo: ComponentInfo, indent: string): string {
    if (!componentInfo.children?.length) {
      return ''
    }

    // Get type property if present and not 'none'
    const type = componentInfo.props?.type
    const typeProps = type && type !== 'none'
      ? `{type="${this.escapeQuotes(type)}"}`
      : ''

    // If there's only one column, wrap it in a center component
    if (componentInfo.children.length === 1) {
      const child = componentInfo.children[0]
      const content = this.preserveIndentation(child.content || child.main || '', indent)
      const needsNewline = !content.endsWith('\n')

      // If the column has props, use layout with a single column
      if (Object.keys(child.props).length > 0) {
        const propsStr = this.formatProps(child.props)
        return `${indent}::ginko-layout${typeProps}\n${indent}::col${propsStr}\n${content}${needsNewline ? '\n' : ''}${indent}::\n${indent}::`
      }

      // For single column without props, use ginko-center with type if provided
      return `${indent}::ginko-center${typeProps}\n${content}${needsNewline ? '\n' : ''}${indent}::`
    }

    // Multiple columns use layout component
    const columnsContent = componentInfo.children.map((child) => {
      // Get content and preserve its original spacing
      const content = this.preserveIndentation(child.content || child.main || '', indent)

      // Format props if any exist
      const propsStr = this.formatProps(child.props)

      // Each column is wrapped in a col component
      // Add a newline after content only if it doesn't end with one
      const needsNewline = !content.endsWith('\n')
      return `${indent}::ginko-column${propsStr}\n${content}${needsNewline ? '\n' : ''}${indent}::`
    }).join('\n')

    return `${indent}::ginko-layout${typeProps}\n${columnsContent}\n${indent}::`
  }

  private preserveIndentation(content: string, baseIndent: string): string {
    // Add the base indentation to each non-empty line
    return content
      .split('\n')
      .map(line => line.trim() ? baseIndent + line : line)
      .join('\n')
  }

  private formatProps(props: Record<string, string>): string {
    if (!props || Object.keys(props).length === 0) {
      return ''
    }

    const propsStr = Object.entries(props)
      .map(([key, value]) => `${key}="${this.escapeQuotes(value)}"`)
      .join(' ')

    return `{${propsStr}}`
  }

  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"')
  }
}
