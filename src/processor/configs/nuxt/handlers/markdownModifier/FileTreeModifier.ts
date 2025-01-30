import { ContentModifier } from '../../markdownModifier'

interface FileTreeOptions {
  title?: string
  icon?: string
  autoSlash?: boolean
  showArrow?: boolean
}

export class FileTreeModifier implements ContentModifier {
  // Match file tree block with specific opening and closing patterns
  private readonly FILE_TREE_REGEX = /^([~`]{3,4})dirtree(?:{([^}]*)})?\n([\s\S]*?)^\1(?:\n|$)/gm

  modify(content: string): string {
    return content.replace(this.FILE_TREE_REGEX, (_, fence, options, treeContent) => {
      const parsedOptions = this.parseOptions(options || '')
      const tree = this.parseTree(treeContent)
      return this.formatFileTree(tree, parsedOptions)
    })
  }

  private parseOptions(optionsStr: string): FileTreeOptions {
    const options: FileTreeOptions = {}
    
    // Match key-value pairs within the options string
    const matches = optionsStr.match(/(\w+)=["']([^"']*?)["']/g) || []
    
    matches.forEach(match => {
      const [key, value] = match.split('=')
      const cleanValue = value.replace(/['"]/g, '')
      
      switch (key) {
        case 'title':
          options.title = cleanValue
          break
        case 'icon':
          options.icon = cleanValue
          break
        case 'autoSlash':
          options.autoSlash = cleanValue.toLowerCase() === 'true'
          break
        case 'showArrow':
          options.showArrow = cleanValue.toLowerCase() === 'true'
          break
      }
    })
    
    return options
  }

  private parseTree(content: string): string[] {
    // Split content into lines and preserve original indentation
    return content
      .split('\n')
      .filter(line => line.trim().length > 0)
  }

  private formatFileTree(tree: string[], options: FileTreeOptions): string {
    const optionsYaml = Object.entries(options)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : value}`)
      .join('\n')

    // Add two spaces of indentation for the tree content under the 'tree:' key
    const treeContent = tree
      .map(line => '  ' + line)  // Add base indentation under 'tree:'
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
