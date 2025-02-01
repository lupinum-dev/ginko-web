import type { GinkoWebSettings } from './settings/settingsTypes'
import { Plugin, setIcon } from 'obsidian'
import { DEFAULT_SETTINGS, GinkoWebSettingTab } from './settings/settings'
import { isSetupComplete } from './settings/settingsTypes'
import { CURRENT_WELCOME_VERSION, WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'

// Remember to rename these classes and interfaces!

export default class GinkoWebPlugin extends Plugin {
  settings: GinkoWebSettings

  async onload() {
    await this.loadSettings()

    // Register the welcome view type
    this.registerView(
      WELCOME_VIEW_TYPE,
      leaf => new WelcomeView(leaf),
    )

    // Show welcome view on first load
    await this.activateWelcomeView()

    // Add status bar item with configuration warning
    const statusBarItemEl = this.addStatusBarItem()
    statusBarItemEl.addClass('ginko-web-status-bar')

    // Update status bar based on configuration
    const updateStatusBar = () => {
      statusBarItemEl.empty()
      statusBarItemEl.removeEventListener('click', openSettings) // Remove old listener

      if (!isSetupComplete(this.settings)) {
        const warningContainer = statusBarItemEl.createSpan({
          cls: 'ginko-web-status-warning',
        })
        setIcon(warningContainer, 'alert-triangle')
        warningContainer.createSpan({ text: ' Complete Ginko Web setup!' })

        statusBarItemEl.style.cursor = 'pointer'
        statusBarItemEl.addEventListener('click', openSettings) // Add new listener
      }
      else {
        const successContainer = statusBarItemEl.createSpan({
          cls: 'ginko-web-status-success',
        })
        setIcon(successContainer, 'check-circle')
        successContainer.createSpan({ text: ' Ginko Web is ready!' })
        statusBarItemEl.style.cursor = 'default'
      }
    }

    // Define click handler separately so we can remove it
    const openSettings = () => {
      this.app.setting.open()
      this.app.setting.openTabById('ginko-web')
    }

    // Initial status update
    updateStatusBar()

    // Update status when settings change
    this.registerEvent(
      this.app.workspace.on('ginko-web:settings-changed', updateStatusBar),
    )

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new GinkoWebSettingTab(this.app, this))
  }

  /**
   * Registers editor extensions
   */

  onunload() {
    // Unregister the welcome view type
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE)
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
    // Emit settings changed event to update UI
    this.app.workspace.trigger('ginko-web:settings-changed')
  }

  async activateWelcomeView(forceShow = false) {
    const storageKey = `ginko-web-welcome-shown-v${CURRENT_WELCOME_VERSION}`

    // Don't show if user has already seen this version (unless forced)
    if (!forceShow && localStorage.getItem(storageKey)) {
      return
    }

    const { workspace } = this.app

    // First check if view is already open
    const existingLeaves = workspace.getLeavesOfType(WELCOME_VIEW_TYPE)
    if (existingLeaves.length > 0) {
      // A leaf with our view already exists, use that
      workspace.revealLeaf(existingLeaves[0])
      return
    }

    // Create a new leaf in the root split (main content area)
    // Use 'split' parameter to ensure we create in the root split
    const leaf = workspace.getLeaf(true)
    if (leaf) {
      await leaf.setViewState({
        type: WELCOME_VIEW_TYPE,
        active: true,
      })
      workspace.revealLeaf(leaf)
    }
  }
}
