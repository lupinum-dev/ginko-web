import type { ContentModifier } from '../../markdownModifier'
import type { ComponentInfo } from './types/ComponentInfo'
import { getComponentInfo } from './utils/componentParser'

interface FileTreeOptions {
  'title'?: string
  'icon'?: string
  'auto-slash'?: boolean
  'show-arrow'?: boolean
}

export class FileTreeModifier implements ContentModifier {
  // Match file tree block with new syntax
  private readonly FILE_TREE_REGEX = /^::file-tree(?:\((.*?)\))?\n([\s\S]*?)^::/gm

  modify(content: string): string {
    console.log('XX')
    return content.replace(this.FILE_TREE_REGEX, (_, options, treeContent) => {
      const parsedOptions = this.parseOptions(options || '')
      console.log(parsedOptions)
      const tree = this.parseTree(treeContent)
      return this.formatFileTree(tree, parsedOptions)
    })
  }

  getComponentInfo(content: string): ComponentInfo | null {
    const info = getComponentInfo(content)

    return info
  }

  private parseOptions(optionsStr: string): FileTreeOptions {
    const options: FileTreeOptions = {}
    if (!optionsStr)
      return options

    const optionsRegex = /(\w+)=["']([^"']*)["']|(\w+)/g
    let match

    while ((match = optionsRegex.exec(optionsStr)) !== null) {
      const [, key, value, flagKey] = match
      if (key && value !== undefined) {
        const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
        switch (kebabKey) {
          case 'title':
            options.title = value
            break
          case 'icon':
            options.icon = value
            break
          case 'auto-slash':
          case 'autoslash':
            options['auto-slash'] = value.toLowerCase() === 'true'
            break
          case 'show-arrow':
          case 'showarrow':
            options['show-arrow'] = true
            break
        }
      }
      else if (flagKey) {
        // Handle boolean flags
        const kebabKey = flagKey.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
        if (kebabKey === 'show-arrow' || kebabKey === 'showarrow') {
          options['show-arrow'] = true
        }
      }
    }

    return options
  }

  private parseTree(content: string): string[] {
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
  }

  private formatFileTree(tree: string[], options: FileTreeOptions): string {
    const optionsYaml = Object.entries(options)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    const treeContent = tree
      .map(line => `  ${line}`)
      .join('\n')

    return `::file-tree
---
${optionsYaml}
tree:
${treeContent}
---
::`
  }
}
