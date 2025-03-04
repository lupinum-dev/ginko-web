import type { Menu, TAbstractFile } from 'obsidian'
import type { GinkoWebSettings } from './settings/settingsTypes'
import { Notice, Plugin, setIcon, TFile, TFolder } from 'obsidian'
import { initializeFileTypeDetector } from './composables/useFileType'
import { initializeGinkoProcessor, useGinkoProcessor } from './composables/useGinkoProcessor'
import { initializeGinkoSettings, updateGinkoSettings } from './composables/useGinkoSettings'
import { CacheService } from './processor/services/CacheService'
import { setupFileWatcher } from './processor/services/fileWatcher'
import { GinkoWebSettingTab } from './settings/settings'
import { DEFAULT_SETTINGS, ensureSettingsInitialized, isSetupComplete } from './settings/settingsTypes'
import { getWebsitePath } from './settings/settingsUtils'
import { createColocationFolder } from './tools/createColocationFolder'
import { ColocationModal } from './ui/modals/ColocationModal'
import { CURRENT_WELCOME_VERSION, WELCOME_VIEW_TYPE, WelcomeView } from './welcome/welcomeView'

export default class GinkoWebPlugin extends Plugin {
  settings: GinkoWebSettings
  private statusBarItem: HTMLElement | null = null
  private fileMenuRegistered: boolean = false
  private ribbonIcons: HTMLElement[] = []

  async onload() {
    // Settings
    const loadedSettings = await this.loadData()
    this.settings = ensureSettingsInitialized(loadedSettings || {})
    this.addSettingTab(new GinkoWebSettingTab(this.app, this))

    // Initialize Ginko Settings
    initializeGinkoSettings(this.settings)
    initializeFileTypeDetector('nuxt')

    // Welcome view
    this.registerView(
      WELCOME_VIEW_TYPE,
      leaf => new WelcomeView(leaf),
    )
    await this.activateWelcomeView()

    // Register Commands
    this.registerCommands()

    // Status Bar
    this.statusBarItem = this.addStatusBarItem()
    this.statusBarItem.addClass('ginko-web-status-bar')
    await this.updateStatusBar()

    // Initialize Ginko Processor
    initializeGinkoProcessor(this.app, this.settings, 'nuxt')

    // Register file menu event
    this.registerFileMenu()

    // File Watcher
    setupFileWatcher(this, this.app)
  }

  onunload() {
    // Unregister the welcome view type
    this.app.workspace.detachLeavesOfType(WELCOME_VIEW_TYPE)
    // Reset the file menu registration flag
    this.fileMenuRegistered = false
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    console.log('saveSettings')
    // Ensure settings are properly initialized before saving
    this.settings = ensureSettingsInitialized(this.settings)

    // Save to disk
    await this.saveData(this.settings)

    // Update Ginko settings and processor
    updateGinkoSettings(this.settings)

    // Re-register file menu to update based on utility settings
    this.registerFileMenu()
    this.registerCommands()

    // Update status bar
    await this.updateStatusBar()
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
    console.log('registerCommands')

    // Remove existing ribbon icons
    this.ribbonIcons.forEach(icon => {
      icon.remove();
    });
    this.ribbonIcons = [];

    // Create a function for the common processor initialization logic
    const initializeProcessor = async () => {
      try {
        const ginkoProcessor = useGinkoProcessor()
        await ginkoProcessor.rebuild()
        new Notice('🟢 Processing completed')
      }
      catch (error) {
        console.error(`Error during processing: ${error.message}`)
        new Notice(`❌ Processing failed: ${error.message}`)
        throw error // Re-throw to maintain error propagation
      }
    }

    // Add commands for Ginko Web functionality
    // Process command - always available
    this.addCommand({
      id: 'ginko-process',
      name: 'Process website content',
      callback: () => {
        initializeProcessor()
      },
    });

    // Open Welcome View command
    this.addCommand({
      id: 'ginko-open-welcome',
      name: 'Open Ginko welcome view',
      callback: () => {
        this.activateWelcomeView(true)
      },
    });

    // Open Settings command
    this.addCommand({
      id: 'ginko-open-settings',
      name: 'Open Ginko settings',
      callback: () => {
        this.app.setting.open()
        this.app.setting.openTabById('ginko-web')
      },
    });

    // Export Cache command
    this.addCommand({
      id: 'ginko-export-cache',
      name: 'Export Ginko cache',
      callback: async () => {
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
    });

    // Create ID command - only available when enabled in settings
    if (this.settings.utilities.createId) {
      this.addCommand({
        id: 'ginko-create-id',
        name: 'Create and copy ID to clipboard',
        callback: async () => {
          try {
            const { copyIdToClipboard } = await import('./tools/createId')
            copyIdToClipboard()
          } catch (error) {
            console.error('Failed to create ID:', error)
            new Notice('❌ Failed to create ID')
          }
        },
      });
    }

    // Create colocation folder command - only available when enabled in settings
    if (this.settings.utilities.colocationFolder) {
      this.addCommand({
        id: 'ginko-create-colocation-folder',
        name: 'Create colocation folder',
        editorCheckCallback: (checking: boolean, editor, view) => {
          const file = view.file;

          // Only enable for markdown files
          if (!file || file.extension !== 'md') {
            return false;
          }

          if (!checking) {
            new ColocationModal(this.app, file, () => {
              createColocationFolder(this.app, file);
            }).open();
          }

          return true;
        },
      });
    }

    // Add this type definition at the top of the file, after the imports
    interface RibbonIcon {
      id: string
      name: string
      handler?: () => Promise<void>
    }
    this.settings.utilities.createId

    // Define ribbon icons with their specific configurations
    const ribbonIcons: RibbonIcon[] = [
      { id: 'upload', name: 'Ginko Process' },

      // Only include the Create ID icon when enabled in settings
      ...(this.settings.utilities.createId ? [{
        id: 'key', name: 'Create ID', handler: async () => {
          try {
            const { copyIdToClipboard } = await import('./tools/createId')
            copyIdToClipboard()
          } catch (error) {
            console.error('Failed to create ID:', error)
            new Notice('❌ Failed to create ID')
          }
        }
      }] : []),
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
      this.ribbonIcons.push(element)
    })
  }

  private async updateStatusBar() {
    if (!this.statusBarItem)
      return

    // Clear existing content
    this.statusBarItem.empty()

    // Ensure settings are properly initialized before checking status
    const settings = ensureSettingsInitialized(this.settings)

    // Get website path info to check for package manager
    const websitePathInfo = await getWebsitePath(
      this.app.vault.adapter,
      settings.paths.type,
      settings.paths.websitePath,
    )
    const hasPackageManager = !!websitePathInfo.runtime

    if (!isSetupComplete(settings, hasPackageManager)) {
      const warningContainer = this.statusBarItem.createSpan({
        cls: 'ginko-web-status-warning',
      })
      setIcon(warningContainer, 'alert-triangle')
      warningContainer.createSpan({ text: ' Complete Ginko Web setup!' })

      this.statusBarItem.style.cursor = 'pointer'

      // Remove any existing click listeners before adding a new one
      const openSettings = () => {
        (this.app as any).setting.open()
          (this.app as any).setting.openTabById('ginko-web')
      }
      this.statusBarItem.onclick = openSettings
    }
  }

  private registerFileMenu() {
    // Only register if the colocation folder utility is enabled and not already registered
    if (this.settings.utilities.colocationFolder && !this.fileMenuRegistered) {
      this.fileMenuRegistered = true
      this.registerEvent(
        this.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
          if (file instanceof TFolder) {
            menu.addItem((item) => {
              console.log('add colocation folder')
              item
                .setTitle('Add Colocation Folder')
                .setIcon('folder-plus')
                .onClick(() => {
                  const modal = new ColocationModal(
                    this.app,
                    this.settings,
                    this.settings.utilities.lastUsedTemplate,
                    async (result) => {
                      try {
                        // Update the last used template setting
                        this.settings.utilities.lastUsedTemplate = result.useTemplate
                        await this.saveSettings()

                        const folderPath = await createColocationFolder(
                          this.app.vault,
                          file.path,
                          result,
                        )
                        new Notice(`Created colocation folder: ${folderPath}`)
                      }
                      catch (error) {
                        console.error('Error creating colocation folder:', error)
                        new Notice(`Error: ${error.message}`)
                      }
                    },
                  )
                  modal.open()
                })
            })
          }
          else if (file instanceof TFile && file.extension === 'md') {
            menu.addItem((item) => {
              item
                .setTitle('Convert to Colocation Folder')
                .setIcon('folder-input')
                .onClick(() => {
                  const modal = new ColocationModal(
                    this.app,
                    this.settings,
                    this.settings.utilities.lastUsedTemplate,
                    async (result) => {
                      try {
                        // Update the last used template setting
                        this.settings.utilities.lastUsedTemplate = result.useTemplate
                        await this.saveSettings()

                        const folderPath = await createColocationFolder(
                          this.app.vault,
                          file.parent?.path || '',
                          result,
                        )
                        new Notice(`Converted to colocation folder: ${folderPath}`)
                      }
                      catch (error) {
                        console.error('Error converting to colocation folder:', error)
                        new Notice(`Error: ${error.message}`)
                      }
                    },
                    file.path,
                  )
                  modal.open()
                })
            })
          }
        }),
      )
    }
  }
}
