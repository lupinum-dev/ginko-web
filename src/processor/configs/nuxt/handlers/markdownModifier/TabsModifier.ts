import type { ContentModifier } from '../../markdownModifier'
import type { ComponentInfo } from './types/ComponentInfo'
import { getComponentInfo } from './utils/componentParser'

export class TabsModifier implements ContentModifier {
  // Match tabs block with new syntax
  private readonly TABS_REGEX = /^::tabs(?:\(.*?\))?\n([\s\S]*?)^::/gm

  modify(content: string): string {
    return content.replace(this.TABS_REGEX, (match) => {
      const componentInfo = this.getComponentInfo(match)
      console.log('Component info:', componentInfo)
      if (!componentInfo) {
        console.error('Failed to parse component info')
        return match
      }

      return this.formatTabs(componentInfo)
    })
  }

  getComponentInfo(content: string): ComponentInfo | null {
    return getComponentInfo(content)
  }

  private formatTabs(componentInfo: ComponentInfo): string {
    if (!componentInfo.children?.length) {
      return ''
    }

    const tabsContent = componentInfo.children.map((child) => {
      // Props are already processed in the parser, including the title
      const propsStr = Object.entries(child.props)
        .map(([key, value]) => `${key}="${this.escapeQuotes(value)}"`)
        .join(' ')

      // Use content if available, otherwise use main
      const content = child.content || child.main || ''

      return `::div{${propsStr}}\n${content}\n::`
    }).join('\n')

    return `::tabs\n${tabsContent}\n::`
  }

  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"')
  }
}
