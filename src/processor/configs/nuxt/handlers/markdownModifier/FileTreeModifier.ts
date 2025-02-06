import type { ContentModifier } from '../../markdownModifier'
import type { ComponentInfo } from './types/ComponentInfo'
import { getComponentInfo } from './utils/componentParser'

export class FileTreeModifier implements ContentModifier {
  // Match file tree block with new syntax
  private readonly FILE_TREE_REGEX = /^::file-tree(?:\((.*?)\))?\n([\s\S]*?)^::/gm

  modify(content: string): string {
    return content.replace(this.FILE_TREE_REGEX, (match, options, treeContent) => {
      // Construct the input string properly with newlines
      const input = `::file-tree${options ? `(${options})` : ''}\n${treeContent}\n::`
      console.error('Parsing input:', input)

      const componentInfo = this.getComponentInfo(input)
      if (!componentInfo) {
        console.error('Failed to parse component info')
        return match
      }

      console.error('Component info:', componentInfo)
      return this.formatFileTree(componentInfo)
    })
  }

  getComponentInfo(content: string): ComponentInfo | null {
    return getComponentInfo(content)
  }

  private formatFileTree(componentInfo: ComponentInfo): string {
    const { props, content } = componentInfo
    if (!content) {
      return ''
    }

    // Normalize properties to ensure consistent output
    const normalizedProps: Record<string, string> = {}
    for (const [key, value] of Object.entries(props)) {
      if (key === 'auto' || key === 'slash') {
        // Skip these as they should be combined into auto-slash
        continue
      }
      normalizedProps[key] = value
    }

    const optionsYaml = Object.entries(normalizedProps)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    return `::ginko-file-tree
---
${optionsYaml}
tree:
${content}
---
::`
  }
}
