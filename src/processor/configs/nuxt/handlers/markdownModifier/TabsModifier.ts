import type { ContentModifier } from '../../markdownModifier'

interface Tab {
  title: string
  content: string[]
}

export class TabsModifier implements ContentModifier {
  // Match tabs block with specific opening and closing patterns
  private readonly TABS_BLOCK_REGEX = /^([~`]{3,4})tabs\n([\s\S]*?)^\1(?:\n|$)/gm

  modify(content: string): string {
    return content.replace(this.TABS_BLOCK_REGEX, (_, fence, tabsContent) => {
      const tabs = this.parseTabs(tabsContent)
      return this.formatTabs(tabs)
    })
  }

  private parseTabs(content: string): Tab[] {
    const tabs: Tab[] = []
    let currentTab: Tab | null = null
    let buffer: string[] = []

    // Split content into lines and process each line
    const lines = content.split('\n')
    let inCodeBlock = false
    let codeBlockFence = ''

    for (const line of lines) {
      // Handle code block detection
      if (line.match(/^[~`]{3,4}[a-z0-9]*$/i)) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeBlockFence = line.match(/^[~`]{3,4}/)?.[0] || ''
        }
        else if (line.startsWith(codeBlockFence)) {
          inCodeBlock = false
          codeBlockFence = ''
        }
      }

      // Skip empty lines before first tab
      if (!currentTab && line.trim() === '') {
        continue
      }

      // Only process tab markers if we're not in a code block
      if (!inCodeBlock && line.startsWith('---')) {
        // If we have a current tab, push it to our tabs array
        if (currentTab) {
          // Remove trailing empty lines
          while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') {
            buffer.pop()
          }
          currentTab.content = buffer
          tabs.push(currentTab)
          buffer = []
        }

        // Create new tab with the title (remove leading '---' and trim)
        const title = line.slice(3).trim()
        currentTab = { title, content: [] }
        continue
      }

      // If we have a current tab, add content to it
      if (currentTab) {
        buffer.push(line)
      }
    }

    // Don't forget to add the last tab
    if (currentTab && buffer.length > 0) {
      // Remove trailing empty lines
      while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') {
        buffer.pop()
      }
      currentTab.content = buffer
      tabs.push(currentTab)
    }

    return tabs
  }

  private formatTabs(tabs: Tab[]): string {
    if (tabs.length === 0)
      return ''

    const tabsContent = tabs.map((tab) => {
      const content = tab.content.join('\n')
      return `::tab{title="${this.escapeQuotes(tab.title)}"}\n${content}\n::`
    }).join('\n')

    return `::tabs\n${tabsContent}\n::`
  }

  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"')
  }
}
