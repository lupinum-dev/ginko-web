import type { TAbstractFile } from 'obsidian'
import type { GinkoWebSettings } from './settings/settingsTypes'
import { Notice, Plugin, setIcon, TFile } from 'obsidian'
import { useFileType } from './composables/useFileType'
import { initializeGinkoProcessor, useGinkoProcessor } from './composables/useGinkoProcessor'
import { CacheService } from './processor/services/CacheService'
import { DEFAULT_SETTINGS, GinkoWebSettingTab } from './settings/settings'
import { isSetupComplete } from './settings/settingsTypes'
import { getWebsitePath } from './settings/settingsUtils'
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

    this.registerCommands()

    // Add status bar item with configuration warning
    const statusBarItemEl = this.addStatusBarItem()
    statusBarItemEl.addClass('ginko-web-status-bar')

    // Define click handler
    const openSettings = () => {
      this.app.setting.open()
      this.app.setting.openTabById('ginko-web')
    }

    initializeGinkoProcessor(this.app, this.settings, 'nuxt')
    const ginkoProcessor = useGinkoProcessor()

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on('modify', (file: TAbstractFile) => {
          // console.log('🟡 Modifying file:', file)
          if (file instanceof TFile) {
            ginkoProcessor.addTask(file.path, 'modify')
          }
        }),
      )

      this.registerEvent(
        this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
          if (file instanceof TFile) {
            const { isSameFileType } = useFileType()

            if (isSameFileType(file.path, oldPath)) {
              // If file types are the same, process as a regular rename
              ginkoProcessor.addTask(file.path, 'rename', oldPath)
            }
            else {
              // If file types are different, process as a delete + create
              ginkoProcessor.addTask(oldPath, 'delete')
              ginkoProcessor.addTask(file.path, 'create')
            }
          }
        }),
      )

      this.registerEvent(
        this.app.vault.on('create', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            ginkoProcessor.addTask(file.path, 'create')
          }
        }),
      )

      this.registerEvent(
        this.app.vault.on('delete', (file: TAbstractFile) => {
          if (file instanceof TFile) {
            ginkoProcessor.addTask(file.path, 'delete')
          }
        }),
      )
    })

    // Update status bar based on configuration
    const updateStatusBar = async () => {
      statusBarItemEl.empty()
      statusBarItemEl.removeEventListener('click', openSettings) // Remove old listener

      // Get website path info to check for package manager
      const websitePathInfo = await getWebsitePath(
        this.app.vault.adapter,
        this.settings.websitePath.type,
        this.settings.websitePath.customPath,
      )
      const hasPackageManager = !!websitePathInfo.runtime

      if (!isSetupComplete(this.settings, hasPackageManager)) {
        const warningContainer = statusBarItemEl.createSpan({
          cls: 'ginko-web-status-warning',
        })
        setIcon(warningContainer, 'alert-triangle')
        warningContainer.createSpan({ text: ' Complete Ginko Web setup!' })

        statusBarItemEl.style.cursor = 'pointer'
        statusBarItemEl.addEventListener('click', openSettings) // Add new listener
      }
    }

    // Initial status update
    updateStatusBar()

    // Update status when settings change
    this.registerEvent(
      this.app.workspace.on('ginko-web:settings-changed', () => {
        updateStatusBar()
      }),
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

  private registerCommands() {
    // Create a function for the common processor initialization logic
    const initializeProcessor = async () => {
      try {
        const ginkoProcessor = useGinkoProcessor()
        await ginkoProcessor.rebuild()
        new Notice('🟢 Processing completed')
        // console.log('Processing completed for all vault files');
      }
      catch (error) {
        console.error(`Error during processing: ${error.message}`)
        new Notice(`❌ Processing failed: ${error.message}`)
        throw error // Re-throw to maintain error propagation
      }
    }

    // Add this type definition at the top of the file, after the imports
    interface RibbonIcon {
      id: string
      name: string
      handler?: () => Promise<void>
    }

    // Define ribbon icons with their specific configurations
    const ribbonIcons: RibbonIcon[] = [
      { id: 'upload', name: 'Ginko Process' },
      {
        id: 'database',
        name: 'Export GinkoCache',
        handler: async () => {
          try {
            const cacheService = new CacheService()
            await cacheService.exportCacheToFile(this.app.vault)
            new Notice('✅ Cache exported successfully!')
          }
          catch (error) {
            console.error('Failed to export cache:', error)
            new Notice('❌ Failed to export cache')
          }
        },
      },
    ]

    // Create ribbon icons using the common configuration
    ribbonIcons.forEach((icon) => {
      const element = this.addRibbonIcon(icon.id, icon.name, (evt: MouseEvent) => {
        if (icon.handler) {
          icon.handler()
        }
        else {
          initializeProcessor()
        }
      })

      element.addClass('my-plugin-ribbon-class')
    })
  }
}
