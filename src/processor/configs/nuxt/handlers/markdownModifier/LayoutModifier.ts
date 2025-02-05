import type { ContentModifier } from '../../markdownModifier'
import type { ComponentInfo } from './types/ComponentInfo'
import { getComponentInfo } from './utils/componentParser'

export class LayoutModifier implements ContentModifier {
  // Match layout block with new syntax
  private readonly LAYOUT_REGEX = /^([ \t]*)::layout\n([\s\S]*?)^\1::/gm

  modify(content: string): string {
    return content.replace(this.LAYOUT_REGEX, (match, indent = '', innerContent) => {
      const componentInfo = this.getComponentInfo(match)
      if (!componentInfo) {
        console.error('Failed to parse component info')
        return match
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

    // If there's only one column, wrap it in a center component
    if (componentInfo.children.length === 1) {
      const child = componentInfo.children[0]
      const content = this.preserveIndentation(child.content || child.main || '', indent)
      const needsNewline = !content.endsWith('\n')

      // If the column has props, use layout with a single column
      if (Object.keys(child.props).length > 0) {
        const propsStr = this.formatProps(child.props)
        return `${indent}::layout\n${indent}::col${propsStr}\n${content}${needsNewline ? '\n' : ''}${indent}::\n${indent}::`
      }

      return `${indent}::center\n${content}${needsNewline ? '\n' : ''}${indent}::`
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
      return `${indent}::col${propsStr}\n${content}${needsNewline ? '\n' : ''}${indent}::`
    }).join('\n')

    return `${indent}::layout\n${columnsContent}\n${indent}::`
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
