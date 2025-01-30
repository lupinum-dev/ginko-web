import type { WorkspaceLeaf } from 'obsidian'
import { ItemView, MarkdownRenderer } from 'obsidian'

export const WELCOME_VIEW_TYPE = 'ginko-web-welcome-view'
export const CURRENT_WELCOME_VERSION = '0.0.1' // Increment this when you want to show the welcome screen again
const STORAGE_KEY = `ginko-web-welcome-shown-v${CURRENT_WELCOME_VERSION}`

export class WelcomeView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType(): string {
    return WELCOME_VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Welcome to Ginko Web'
  }

  getIcon(): string {
    return 'sparkle'
  }

  async onOpen() {
    // Get the content container
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('ginko-web-welcome-view')

    const welcomeContent = `# Welcome to Ginko Web! 🎉

## 📚 Documentation

Get started with our comprehensive documentation. Learn about component usage, examples, and best practices.

[Get me started! 🚀](https://ginko.build/docs)

## 🎮 Join Our Community

- Get help and support
- Stay updated on new features

[Join Discord Server](https://discord.gg/SSGK5tuqJh)
`

    await MarkdownRenderer.renderMarkdown(
      welcomeContent,
      container,
      '',
      this,
    )
  }

  async onClose() {
    // Clean up by emptying the container
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()

    // Mark as shown in local storage with version
    localStorage.setItem(STORAGE_KEY, 'true')
  }
}
