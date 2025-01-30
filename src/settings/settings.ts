import type { App } from 'obsidian'
import type GinkoWebPlugin from '../main'
import type { GinkoScope } from './resetModal'
import { relative } from 'node:path'
import { PluginSettingTab, Setting } from 'obsidian'
import { ResetModal } from './resetModal'
import { ResetStorageModal } from './resetStorage'

interface UtilityLink {
  text: string
  url: string
}

interface Utility {
  id: keyof GinkoWebSettings['utilities']
  name: string
  description: string
  warning: string
  links: UtilityLink[]
}

export interface GinkoWebSettings {
  components: {
    aspectImage: boolean
    card: boolean
    cardGrid: boolean
    fileTree: boolean
    gallery: boolean
    galleryFolder: boolean
    layout: boolean
    steps: boolean
    tabs: boolean
    [key: string]: boolean
  }
  utilities: {
    iconify: boolean
    syntaxHighlight: boolean
    debug: boolean
    [key: string]: boolean
  }
  websitePath: {
    type: 'standard' | 'custom'
    customPath?: string
    pathType?: 'relative' | 'absolute'
  }
  languages: {
    multipleLanguages: boolean
    mainLanguage: string
  }
  exclusions: {
    ignoredFolders: string
    ignoredFiles: string
  }
  mySetting: string
}

export const DEFAULT_SETTINGS: GinkoWebSettings = {
  components: {
    aspectImage: false,
    card: false,
    cardGrid: false,
    fileTree: false,
    gallery: false,
    galleryFolder: false,
    layout: false,
    steps: false,
    tabs: false,
  },
  utilities: {
    iconify: false,
    syntaxHighlight: false,
    debug: false,
  },
  websitePath: {
    type: 'standard',
  },
  languages: {
    multipleLanguages: false,
    mainLanguage: 'en',
  },
  exclusions: {
    ignoredFolders: '',
    ignoredFiles: '',
  },
  mySetting: 'default',
}

export class GinkoWebSettingTab extends PluginSettingTab {
  plugin: GinkoWebPlugin

  constructor(app: App, plugin: GinkoWebPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  private updatePathsDisplay(pathsDiv: HTMLElement): void {
    // Clear existing paths display
    pathsDiv.empty()

    const pathsTitle = pathsDiv.createEl('h3', { text: 'Current Paths' })

    // Vault Path
    const vaultPath = this.app.vault.adapter.getBasePath()
    const vaultPathDiv = pathsDiv.createDiv('ginko-web-settings-path-item')
    const vaultPathHeader = vaultPathDiv.createDiv('ginko-web-settings-path-header')
    vaultPathHeader.createSpan({ text: 'ObsidianVault Path: ', cls: 'ginko-web-settings-path-label' })
    const vaultButtonsDiv = vaultPathHeader.createDiv('ginko-web-settings-path-buttons')
    vaultButtonsDiv.appendChild(this.createCopyButton(vaultPath))
    vaultButtonsDiv.appendChild(this.createOpenButton(vaultPath))

    const vaultPathValue = vaultPathDiv.createDiv({
      text: vaultPath,
      cls: 'ginko-web-settings-path-value',
    })

    // Website Path
    const websitePath = this.getWebsitePath()
    const websitePathDiv = pathsDiv.createDiv('ginko-web-settings-path-item')
    const websitePathHeader = websitePathDiv.createDiv('ginko-web-settings-path-header')
    websitePathHeader.createSpan({ text: 'Website Path: ', cls: 'ginko-web-settings-path-label' })
    const websiteButtonsDiv = websitePathHeader.createDiv('ginko-web-settings-path-buttons')
    if (websitePath !== '<Not set>') {
      websiteButtonsDiv.appendChild(this.createCopyButton(websitePath))
      websiteButtonsDiv.appendChild(this.createOpenButton(websitePath))
    }

    const websitePathValue = websitePathDiv.createDiv({
      text: websitePath,
      cls: 'ginko-web-settings-path-value',
    })
  }

  // Move helper functions to class methods
  private getWebsitePath(): string {
    if (!this.plugin.settings.websitePath.type) {
      return '<Not configured>'
    }

    if (this.plugin.settings.websitePath.type === 'standard') {
      const vaultPath = this.app.vault.adapter.getBasePath()
      const parentDir = vaultPath.split('/').slice(0, -1).join('/')
      return parentDir
    }
    else {
      const customPath = this.plugin.settings.websitePath.customPath || ''
      if (!customPath)
        return '<Not set>'

      if (this.plugin.settings.websitePath.pathType === 'relative') {
        const vaultPath = this.app.vault.adapter.getBasePath()
        return require('node:path').resolve(vaultPath, customPath)
      }
      return customPath
    }
  }

  private createCopyButton(text: string): HTMLElement {
    const button = createEl('button')
    button.addClass('ginko-web-settings-copy-btn')
    const icon = createEl('span')
    icon.addClass('ginko-web-settings-copy-icon')
    icon.setText('📋')
    button.appendChild(icon)
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(text)
      icon.setText('✓')
      setTimeout(() => {
        icon.setText('📋')
      }, 2000)
    })
    return button
  }

  private createOpenButton(path: string): HTMLElement {
    const button = createEl('button')
    button.addClass('ginko-web-settings-open-btn')
    const icon = createEl('span')
    icon.setText('📂')
    button.appendChild(icon)
    button.addEventListener('click', () => {
      require('electron').shell.openPath(path)
    })
    return button
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    // Banner
    const bannerDiv = containerEl.createDiv('ginko-web-settings-banner')
    bannerDiv.createDiv('ginko-web-settings-logo')
    const titleDiv = bannerDiv.createDiv('ginko-web-settings-title')
    titleDiv.setText('Ginko Web')
    const descDiv = bannerDiv.createDiv('ginko-web-settings-description')
    descDiv.setText('Enhance your notes with powerful block components')

    // Documentation Area
    containerEl.createEl('h2', { text: 'Documentation' })
    const docDiv = containerEl.createDiv('ginko-web-settings-documentation')
    docDiv.createEl('p', {
      text: 'Please refer to our comprehensive documentation to get the most out of Ginko Web. We have detailed guides on component usage, examples, and best practices.',
    })
    new Setting(docDiv)
      .addButton(button => button
        .setButtonText('📚 Read Documentation')
        .setCta()
        .onClick(() => {
          window.open('https://ginko-web.com/docs', '_blank')
        }))

    // Discord Community
    containerEl.createEl('h2', { text: 'Join Our Community' })
    const discordDiv = containerEl.createDiv('ginko-web-settings-discord')
    const discordList = discordDiv.createEl('ul')
    const discordItems = [
      'Get help and support',
      'Stay updated on new features',
    ]
    discordItems.forEach((item) => {
      discordList.createEl('li', { text: item })
    })
    new Setting(discordDiv)
      .addButton(button => button
        .setButtonText('🎮 Join Discord')
        .setCta()
        .onClick(() => {
          window.open('https://discord.gg/SSGK5tuqJh', '_blank')
        }))

    // The only difficult part of ginko is to setup, once you have dont that its smooth sailing.
    // So please read the documentation carefully!

    containerEl.createEl('h2', { text: 'Setup' })

    // Website Path Settings
    new Setting(containerEl)
      .setName('Website Folder Location')
      .setDesc(createFragment((el) => {
        el.createSpan({ text: 'Define where your website folder will be located. ' })
        el.createEl('a', {
          text: 'Learn more about paths',
          href: 'https://ginko-web.com/docs/setup/paths',
          cls: 'ginko-web-settings-inline-link',
        })
      }))
      .addDropdown(dropdown => dropdown
        .addOption('', 'Select location type...')
        .addOption('standard', 'Standard (Next to Ginko folder)')
        .addOption('custom', 'Custom Path')
        .setValue(this.plugin.settings.websitePath.type || '')
        .onChange(async (value) => {
          this.plugin.settings.websitePath.type = value as 'standard' | 'custom'
          await this.plugin.saveSettings()
          this.updatePathsDisplay(pathsDiv)
          this.display()
        }))

    if (this.plugin.settings.websitePath.type === 'custom') {
      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Path Type')
        .addDropdown(dropdown => dropdown
          .addOption('relative', 'Relative to vault')
          .addOption('absolute', 'Absolute path')
          .setValue(this.plugin.settings.websitePath.pathType || 'relative')
          .onChange(async (value) => {
            this.plugin.settings.websitePath.pathType = value as 'relative' | 'absolute'
            await this.plugin.saveSettings()
            this.updatePathsDisplay(pathsDiv)
          }))

      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Custom Path')
        .setDesc('Enter the path to your website folder')
        .addText(text => text
          .setPlaceholder('Enter path...')
          .setValue(this.plugin.settings.websitePath.customPath || '')
          .onChange(async (value) => {
            this.plugin.settings.websitePath.customPath = value
            await this.plugin.saveSettings()
            this.updatePathsDisplay(pathsDiv)
          }))
    }

    // Current Paths Display (moved to end of setup section)
    const pathsDiv = containerEl.createDiv('ginko-web-settings-paths')
    pathsDiv.addClass('ginko-web-settings-info-box')
    this.updatePathsDisplay(pathsDiv)

    // Language Settings
    new Setting(containerEl)
      .setName('Multiple Languages')
      .setDesc('Enable support for multiple languages')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.languages.multipleLanguages)
        .onChange(async (value) => {
          this.plugin.settings.languages.multipleLanguages = value
          await this.plugin.saveSettings()
          this.display()
        }))

    if (this.plugin.settings.languages.multipleLanguages) {
      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Main Language')
        .setDesc('Set your main language (e.g., en, es, fr)')
        .addText(text => text
          .setPlaceholder('en')
          .setValue(this.plugin.settings.languages.mainLanguage)
          .onChange(async (value) => {
            this.plugin.settings.languages.mainLanguage = value
            await this.plugin.saveSettings()
          }))
    }

    // Exclusions Settings
    containerEl.createEl('h3', { text: 'Exclusions' })

    new Setting(containerEl)
      .setName('Ignored Folders')
      .setDesc('Folders to exclude from processing (comma-separated)')
      .addTextArea(text => text
        .setPlaceholder('folder1, folder2, folder3')
        .setValue(this.plugin.settings.exclusions.ignoredFolders)
        .onChange(async (value) => {
          this.plugin.settings.exclusions.ignoredFolders = value
          await this.plugin.saveSettings()
        }))

    new Setting(containerEl)
      .setName('Ignored Files')
      .setDesc('Files to exclude from processing (comma-separated)')
      .addTextArea(text => text
        .setPlaceholder('file1.md, file2.md')
        .setValue(this.plugin.settings.exclusions.ignoredFiles)
        .onChange(async (value) => {
          this.plugin.settings.exclusions.ignoredFiles = value
          await this.plugin.saveSettings()
        }))

    // Add Utilities Section
    containerEl.createEl('h2', { text: 'Utilities' })

    // Add Changelog Section
    new Setting(containerEl)
      .setName('Changelog & Updates')
      .setDesc('View the latest changes and updates to Ginko Web')
      .addButton(button => button
        .setButtonText('Show Welcome & Changelog')
        .onClick(async () => {
          // Access the plugin instance to call activateWelcomeView
          await this.plugin.activateWelcomeView(true)
        }))

    const utilities: Utility[] = [
      {
        id: 'colocationFolder',
        name: 'Colocation Folder',
        description: 'Utility which helps you to create a colocation folder.',
        warning: '',
        links: [
          { text: 'Read our documentation', url: 'https://ginko.build/docs/utilities/syntax-highlight' },
        ],
      },
      {
        id: 'linter',
        name: 'Linter',
        description: 'Utility which helps you to checks your files for errors.',
        warning: '',
        links: [
          { text: 'Read our documentation', url: 'https://ginko.build/docs/utilities/syntax-highlight' },
        ],
      },
      {
        id: 'debug',
        name: 'Debug Mode',
        description: 'Enable debug logging to help troubleshoot issues.',
        warning: 'Note: Enabling debug mode may affect performance and will output additional logs to the console.',
        links: [],
      },
    ]

    utilities.forEach((utility) => {
      const setting = new Setting(containerEl)
      setting.setName(utility.name)
      setting.setDesc(createFragment((el) => {
        // Create main description container
        const descContainer = el.createDiv({ cls: 'ginko-web-settings-description-container' })

        // Add main description text
        descContainer.createDiv({
          text: utility.description,
          cls: 'ginko-web-settings-utility-description',
        })

        // Add warning text if present
        if (utility.warning) {
          descContainer.createDiv({
            text: utility.warning,
            cls: ['ginko-web-settings-warning', 'mod-warning'],
          })
        }

        // Add links if present
        if (utility.links && utility.links.length > 0) {
          const linksContainer = descContainer.createDiv({ cls: 'ginko-web-settings-links-container' })
          utility.links.forEach((link) => {
            linksContainer.createEl('a', {
              text: link.text,
              cls: 'ginko-web-settings-doc-link',
              href: link.url,
            })
          })
        }
      }))
      setting.addToggle(toggle => toggle
        .setValue(this.plugin.settings.utilities[utility.id])
        .onChange(async (value) => {
          this.plugin.settings.utilities[utility.id] = value
          await this.plugin.saveSettings()
        }))
    })

    // Reset Section - Danger Zone
    containerEl.createEl('h2', { text: 'Danger Zone' })

    const dangerZone = containerEl.createDiv('ginko-web-settings-danger-zone')
    const dangerHeader = dangerZone.createDiv('ginko-web-settings-danger-header')
    const dangerContent = dangerZone.createDiv('ginko-web-settings-danger-content')
    dangerContent.style.display = 'none'

    new Setting(dangerHeader)
      .setName('Show Reset Options')
      .setDesc('Display options to reset components. Be careful with these settings!')
      .addToggle(toggle => toggle
        .setValue(false)
        .onChange((value) => {
          dangerContent.style.display = value ? 'block' : 'none'
        }))

    // Move reset options inside dangerContent
    dangerContent.createEl('h3', { text: 'Reset Components' })
    components.forEach((component) => {
      new Setting(dangerContent)
        .setName(`Reset ${component.name}`)
        .addButton(button => button
          .setButtonText('Current File')
          .onClick(() => this.showResetConfirmation(component.name, 'file')),
        )
        .addButton(button => button
          .setButtonText('Whole Vault')
          .onClick(() => this.showResetConfirmation(component.name, 'vault')),
        )
    })

    // Reset All button inside danger zone
    dangerContent.createEl('h3', { text: 'Reset All Components' })
    new Setting(dangerContent)
      .setDesc('Reset all components at once')
      .addButton(button => button
        .setButtonText('Reset Current File')
        .onClick(() => this.showResetConfirmation('all components', 'file')),
      )
      .addButton(button => button
        .setButtonText('Reset Whole Vault')
        .onClick(() => this.showResetConfirmation('all components', 'vault')),
      )

    // Add Local Storage Reset Section
    dangerContent.createEl('h3', { text: 'Reset Local Storage' })
    new Setting(dangerContent)
      .setDesc('View and delete Ginko Web local storage data')
      .addButton(button => button
        .setButtonText('Manage Local Storage')
        .setWarning()
        .onClick(() => {
          new ResetStorageModal(this.app).open()
        }))
  }

  private showResetConfirmation(component: string, scope: GinkoScope): void {
    new ResetModal(
      this.app,
      component,
      scope,
      () => {
        // TODO: Implement actual reset logic here
      },
    ).open()
  }
}
