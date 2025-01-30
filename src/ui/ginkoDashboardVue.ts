import type { WorkspaceLeaf } from 'obsidian'
import type { GinkoPlugin } from '../types/GinkoPlugin'
import { ItemView } from 'obsidian'
import { createApp } from 'vue'
import GinkoDashboard from '../ui/GinkoDashboard.vue'

export const VIEW_TYPE = 'ginko-dashboard-view'

export class GinkoDashboardView extends ItemView {
  private vueApp: any

  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType(): string {
    return VIEW_TYPE
  }

  getDisplayText(): string {
    return 'Ginko Dashboard'
  }

  getIcon(): string {
    return 'dice'
  }

  async onOpen() {
    const container = this.containerEl.children[1]
    container.empty()
    container.createEl('div', { cls: 'ginko-dashboard-container' })

    // Wait for plugin to be available
    let retries = 0
    const maxRetries = 5

    const getPlugin = async () => {
      const plugin = (this.app as any).plugins.plugins.Bernstein as GinkoPlugin

      if (plugin) {
        console.log('Found plugin:', plugin)
        return plugin
      }

      if (retries >= maxRetries) {
        throw new Error('Failed to get Bernstein plugin. Please ensure the plugin is enabled.')
      }

      retries++
      await new Promise(resolve => setTimeout(resolve, 500))
      return getPlugin()
    }

    try {
      const plugin = await getPlugin()

      // Create and mount Vue app with plugin prop
      this.vueApp = createApp(GinkoDashboard, {
        plugin,
      })
      this.vueApp.mount(container.children[0])
    }
    catch (error) {
      console.error('Failed to initialize dashboard:', error)
      // Show error in the UI
      const errorDiv = container.createEl('div', {
        cls: 'ginko-error',
        text: `Failed to initialize dashboard: ${error.message}`,
      })
    }
  }

  async onClose() {
    if (this.vueApp) {
      this.vueApp.unmount()
    }
  }
}
