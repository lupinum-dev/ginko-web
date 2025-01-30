import type { App } from 'obsidian'
import type GinkoWebPlugin from '../main'
import type { GinkoScope } from './resetModal'
import { PluginSettingTab, Setting } from 'obsidian'
import { ResetModal } from './resetModal'

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
  utilities: {
    debug: boolean
    colocationFolder: boolean
    linter: boolean
    [key: string]: boolean
  }
  websitePath: {
    type: 'none' | 'standard' | 'custom'
    customPath?: string
    pathType?: 'relative' | 'absolute'
    template?: string
  }
  languages: {
    multipleLanguages: boolean
    mainLanguage: string
  }
  exclusions: {
    ignoredFolders: string
    ignoredFiles: string
  }
  pathConfiguration: {
    isConfigured: boolean
  }
}

export const DEFAULT_SETTINGS: GinkoWebSettings = {
  utilities: {
    debug: false,
    colocationFolder: false,
    linter: false,
  },
  websitePath: {
    type: 'none',
    template: '',
  },
  languages: {
    multipleLanguages: false,
    mainLanguage: 'en',
  },
  exclusions: {
    ignoredFolders: '',
    ignoredFiles: '',
  },
  pathConfiguration: {
    isConfigured: false,
  },
}

export class GinkoWebSettingTab extends PluginSettingTab {
  plugin: GinkoWebPlugin

  constructor(app: App, plugin: GinkoWebPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  private async checkWebsiteFolder(path: string): Promise<{ valid: boolean, runtime?: 'npm' | 'pnpm' | 'deno' | 'bun' }> {
    try {
      console.log('Checking website folder:', path)

      // Remove any trailing slashes from the path
      const cleanPath = path.replace(/\/+$/, '')

      // Use Node's fs instead of Obsidian's adapter
      const fs = require('node:fs')

      // Check for package managers
      const packageJsonPath = `${cleanPath}/package.json`
      const pnpmLockPath = `${cleanPath}/pnpm-lock.yaml`
      const npmLockPath = `${cleanPath}/package-lock.json`

      console.log('Checking package files at:', { packageJsonPath, pnpmLockPath, npmLockPath })

      // First check if package.json exists
      if (fs.existsSync(packageJsonPath)) {
        // Then determine which package manager
        if (fs.existsSync(pnpmLockPath)) {
          console.log('Found pnpm project')
          return { valid: true, runtime: 'pnpm' }
        }
        if (fs.existsSync(npmLockPath)) {
          console.log('Found npm project')
          return { valid: true, runtime: 'npm' }
        }
        // If no lock file found, default to npm
        console.log('Found package.json without lock file, assuming npm')
        return { valid: true, runtime: 'npm' }
      }

      // Check for Deno's configuration files
      const denoJsonPath = `${cleanPath}/deno.json`
      const denoJsoncPath = `${cleanPath}/deno.jsonc`

      if (fs.existsSync(denoJsonPath) || fs.existsSync(denoJsoncPath)) {
        console.log('Found deno config')
        return { valid: true, runtime: 'deno' }
      }

      // Check for Bun's lock file
      const bunLockPath = `${cleanPath}/bun.lockb`

      if (fs.existsSync(bunLockPath)) {
        console.log('Found bun lock')
        return { valid: true, runtime: 'bun' }
      }

      // Additional debug: list directory contents
      try {
        const dirContents = fs.readdirSync(cleanPath)
        console.log('Directory contents:', dirContents)
      }
      catch (e) {
        console.log('Could not read directory:', e)
      }

      console.log('No runtime files found')
      return { valid: false }
    }
    catch (error) {
      console.error('Error checking website folder:', error)
      return { valid: false }
    }
  }

  private async getWebsitePath(): Promise<{ path: string, status?: 'error' | 'warning' | 'valid', runtime?: string }> {
    if (!this.plugin.settings.websitePath.type || this.plugin.settings.websitePath.type === 'none') {
      return { path: '<Not configured>', status: 'error' }
    }

    let websitePath: string
    if (this.plugin.settings.websitePath.type === 'standard') {
      const vaultPath = this.app.vault.adapter.getBasePath()
      websitePath = vaultPath.split('/').slice(0, -2).join('/') // Note: changed to -2 to go up two levels
      console.log('Standard path calculation:', { vaultPath, websitePath })
    }
    else {
      const customPath = this.plugin.settings.websitePath.customPath || ''
      if (!customPath) {
        return { path: '<Not set>', status: 'error' }
      }

      if (this.plugin.settings.websitePath.pathType === 'relative') {
        const vaultPath = this.app.vault.adapter.getBasePath()
        websitePath = require('node:path').resolve(vaultPath, customPath)
        console.log('Relative path calculation:', { vaultPath, customPath, resolvedPath: websitePath })
      }
      else {
        websitePath = customPath
        console.log('Absolute path:', websitePath)
      }
    }

    // Check if the folder exists and contains required files
    console.log('Checking path:', websitePath)
    const checkResult = await this.checkWebsiteFolder(websitePath)
    console.log('Check result:', checkResult)

    return {
      path: websitePath,
      status: checkResult.valid ? 'valid' : 'warning',
      runtime: checkResult.runtime,
    }
  }

  private async checkVaultFolder(path: string): Promise<boolean> {
    try {
      const fs = require('node:fs')
      return fs.existsSync(`${path}/.obsidian`)
    }
    catch (error) {
      console.error('Error checking vault folder:', error)
      return false
    }
  }

  private async updatePathsDisplay(pathsDiv: HTMLElement): Promise<void> {
    pathsDiv.empty()
    const pathsTitle = pathsDiv.createEl('h3', { text: 'Current Configuration' })

    // Vault Path Section
    const vaultPath = this.app.vault.adapter.getBasePath()
    const isObsidianVault = await this.checkVaultFolder(vaultPath)

    // Website Path Section
    const websitePathInfo = await this.getWebsitePath()

    // Update configuration status
    const isConfigured = isObsidianVault && websitePathInfo.status === 'valid'
    if (this.plugin.settings.pathConfiguration.isConfigured !== isConfigured) {
      this.plugin.settings.pathConfiguration.isConfigured = isConfigured
      await this.plugin.saveSettings()
    }

    const vaultPathDiv = pathsDiv.createDiv('ginko-web-settings-path-item')
    const vaultPathHeader = vaultPathDiv.createDiv('ginko-web-settings-path-header')
    const vaultHeaderLeft = vaultPathHeader.createDiv('ginko-web-settings-path-header-left')
    vaultHeaderLeft.createSpan({ text: 'Vault Path: ', cls: 'ginko-web-settings-path-label' })

    // Check for Obsidian folder and add badge
    if (isObsidianVault) {
      vaultHeaderLeft.createSpan({
        cls: 'ginko-web-settings-runtime-badge mod-obsidian',
        text: 'OBSIDIAN',
      })
    }

    const vaultButtonsDiv = vaultPathHeader.createDiv('ginko-web-settings-path-buttons')
    vaultButtonsDiv.appendChild(this.createCopyButton(vaultPath))
    vaultButtonsDiv.appendChild(this.createOpenButton(vaultPath))

    const vaultPathValue = vaultPathDiv.createDiv({
      text: vaultPath,
      cls: 'ginko-web-settings-path-value mod-valid',
    })

    const websitePathDiv = pathsDiv.createDiv('ginko-web-settings-path-item')
    const websitePathHeader = websitePathDiv.createDiv('ginko-web-settings-path-header')
    const websiteHeaderLeft = websitePathHeader.createDiv('ginko-web-settings-path-header-left')
    websiteHeaderLeft.createSpan({ text: 'Website Path: ', cls: 'ginko-web-settings-path-label' })

    // Add runtime badge if found
    if (websitePathInfo.runtime) {
      websiteHeaderLeft.createSpan({
        cls: `ginko-web-settings-runtime-badge mod-${websitePathInfo.runtime}`,
        text: websitePathInfo.runtime.toUpperCase(),
      })
    }

    const websiteButtonsDiv = websitePathHeader.createDiv('ginko-web-settings-path-buttons')
    if (websitePathInfo.path !== '<Not set>' && websitePathInfo.path !== '<Not configured>') {
      websiteButtonsDiv.appendChild(this.createCopyButton(websitePathInfo.path))
      websiteButtonsDiv.appendChild(this.createOpenButton(websitePathInfo.path))
    }

    const websitePathValue = websitePathDiv.createDiv({
      text: websitePathInfo.path,
      cls: `ginko-web-settings-path-value ${websitePathInfo.status ? `mod-${websitePathInfo.status}` : ''}`,
    })

    // Add status messages
    const statusDiv = pathsDiv.createDiv('ginko-web-settings-path-status')
    if (isConfigured) {
      statusDiv.createDiv({
        text: '✓ Configuration valid - Ready to use Ginko',
        cls: 'ginko-web-settings-status-message mod-valid',
      })
    }
    else if (websitePathInfo.status === 'warning') {
      statusDiv.createDiv({
        text: '⚠ Website folder found but no package manager detected',
        cls: 'ginko-web-settings-status-message mod-warning',
      })
    }
    else {
      statusDiv.createDiv({
        text: '✕ Website path not properly configured',
        cls: 'ginko-web-settings-status-message mod-error',
      })
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
        .addOption('none', 'Choose location type...')
        .addOption('standard', 'Standard (Next to Ginko folder)')
        .addOption('custom', 'Custom Path')
        .setValue(this.plugin.settings.websitePath.type)
        .onChange(async (value) => {
          this.plugin.settings.websitePath.type = value as 'none' | 'standard' | 'custom'
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

    // Add Website Template Settings
    if (this.plugin.settings.websitePath.type) {
      new Setting(containerEl)
        .setClass('ginko-web-settings-indent')
        .setName('Website Template')
        .setDesc('Choose a predefined template for your website')
        .addDropdown((dropdown) => {
          dropdown.addOption('', 'Select a template...')
          this.WEBSITE_TEMPLATES.forEach((template) => {
            dropdown.addOption(template.id, template.name)
          })
          dropdown.onChange(async (value) => {
            if (!value)
              return
            const template = this.WEBSITE_TEMPLATES.find(t => t.id === value)
            if (template) {
              this.plugin.settings.websitePath.template = value
              await this.plugin.saveSettings()
              console.log('Selected template:', template)
            }
          })

          // Set initial value from settings
          dropdown.setValue(this.plugin.settings.websitePath.template || '')

          // Add template icons and descriptions
          const dropdownEl = dropdown.selectEl
          dropdownEl.querySelectorAll('option').forEach((option) => {
            const template = this.WEBSITE_TEMPLATES.find(t => t.id === option.value)
            if (template) {
              option.innerHTML = `${template.icon} ${template.name}`
              option.setAttribute('title', template.description)
            }
          })
        })
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

    // Add to the display() method at the bottom, after utilities section
    containerEl.createEl('h2', { text: 'Debug' })

    new Setting(containerEl)
      .setName('Show Current Settings')
      .setDesc('Display and copy the current plugin settings')
      .addToggle(toggle => toggle
        .setValue(false)
        .onChange((value) => {
          const debugSection = containerEl.querySelector('.ginko-web-settings-debug-section')
          if (debugSection) {
            debugSection.style.display = value ? 'block' : 'none'
          }
        }))

    // Create debug section
    const debugSection = containerEl.createDiv('ginko-web-settings-debug-section')
    debugSection.style.display = 'none'

    // Create settings display
    const settingsDisplay = debugSection.createEl('pre', {
      cls: 'ginko-web-settings-debug-content',
      text: JSON.stringify(this.plugin.settings, null, 2),
    })

    // Create button container
    const buttonContainer = debugSection.createDiv('ginko-web-settings-debug-buttons')

    // Add refresh button
    const refreshButton = createEl('button', {
      cls: 'ginko-web-settings-debug-button',
      text: '🔄 Refresh',
    })
    buttonContainer.appendChild(refreshButton)

    refreshButton.addEventListener('click', () => {
      settingsDisplay.setText(JSON.stringify(this.plugin.settings, null, 2))
      refreshButton.setText('🔄 Refreshed!')
      setTimeout(() => {
        refreshButton.setText('🔄 Refresh')
      }, 2000)
    })

    // Add copy button
    const copyButton = createEl('button', {
      cls: 'ginko-web-settings-debug-button',
      text: '📋 Copy Settings',
    })
    buttonContainer.appendChild(copyButton)

    copyButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(JSON.stringify(this.plugin.settings, null, 2))
      copyButton.setText('📋 Copied!')
      setTimeout(() => {
        copyButton.setText('📋 Copy Settings')
      }, 2000)
    })
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

  private readonly WEBSITE_TEMPLATES: WebsiteTemplate[] = [
    {
      id: 'nuxt-ui-pro-docs',
      name: 'Nuxt UI Pro Docs',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#00DC82" d="M96.3 117.5c3-4.5 7.6-7.5 12.9-7.5h38.4c5.3 0 9.9 3 12.9 7.5l19.2 30c3 4.5 3 10.5 0 15l-19.2 30c-3 4.5-7.6 7.5-12.9 7.5h-38.4c-5.3 0-9.9-3-12.9-7.5l-19.2-30c-3-4.5-3-10.5 0-15l19.2-30Z"/></svg>',
      description: 'Beautiful documentation template with Nuxt UI Pro components',
    },
    {
      id: 'nuxt-ui-pro-saas',
      name: 'Nuxt UI Pro SaaS',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#00DC82" d="M96.3 117.5c3-4.5 7.6-7.5 12.9-7.5h38.4c5.3 0 9.9 3 12.9 7.5l19.2 30c3 4.5 3 10.5 0 15l-19.2 30c-3 4.5-7.6 7.5-12.9 7.5h-38.4c-5.3 0-9.9-3-12.9-7.5l-19.2-30c-3-4.5-3-10.5 0-15l19.2-30Z"/></svg>',
      description: 'SaaS template with authentication and billing',
    },
    {
      id: 'docusaurus',
      name: 'Docusaurus',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#3ECC5F" d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128s128-57.3 128-128S198.7 0 128 0Z"/></svg>',
      description: 'Modern static website generator by Facebook/Meta',
    },
    {
      id: 'astro-starlight',
      name: 'Astro Starlight',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#FF5D01" d="M163.008 19.198c6.177-7.363 17.082-8.38 24.586-2.375c7.504 6.006 8.525 16.711 2.348 24.074L84.698 164.902c-6.177 7.363-17.082 8.38-24.586 2.375c-7.504-6.006-8.525-16.711-2.348-24.074l105.244-124.005Z"/></svg>',
      description: 'Documentation theme for Astro with full-featured markdown support',
    },
    {
      id: 'fumadocs',
      name: 'FumaDocs',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#4F46E5" d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5s1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>',
      description: 'Next.js documentation starter with full text search',
    },
    {
      id: 'vitepress',
      name: 'VitePress',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="#41B883" d="m179.086 39.543l-50.95 88.272l-50.95-88.272H0l128.136 221.954L256 39.543z"/></svg>',
      description: 'Simple, powerful, and fast static site generator by Vite',
    },
    {
      id: 'ginko-docs',
      name: 'Ginko Docs',
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="#87285E" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8z"/></svg>',
      description: 'Official Ginko documentation template',
    },
  ]
}
